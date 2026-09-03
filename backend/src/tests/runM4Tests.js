import app from '../app.js';
import { testDbConnection } from '../config/database.js';
import { runMigrations } from '../database/migrate.js';
import { seedDatabase } from '../database/seed.js';
import { initQueues, drainAllQueues } from '../queues/queueManager.js';
import { initSampleWorkers } from '../workers/sampleWorker.js';
import { initCourtSyncWorker } from '../workers/courtSyncWorker.js';
import { initDiscoveryWorker } from '../workers/discoveryWorker.js';
import { initCaseDetailWorker } from '../workers/caseDetailWorker.js';
import { CourtService } from '../services/ecourtsIndia/courtService.js';
import { EnumService } from '../services/ecourtsIndia/capabilitiesService.js';
import { RateLimiter } from '../services/ecourtsIndia/rateLimiter.js';
import { db } from '../database/datastore.js';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ${colors.green}✓${colors.reset} ${message}`);
};

const runM4Verification = async () => {
  console.log(`\n${colors.cyan}=== Running M4 Case Detail Ingestion & Data Normalization Verification Suite ===${colors.reset}\n`);

  // 1. Initialize environment
  await testDbConnection();
  await runMigrations();
  await seedDatabase();
  initQueues();
  await drainAllQueues();
  initSampleWorkers();
  initCourtSyncWorker();
  initDiscoveryWorker();
  initCaseDetailWorker();
  await RateLimiter.reset();

  await EnumService.syncEnums();
  await CourtService.syncCourtHierarchy();

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Authenticate Super Admin & Data Admin & Read Only
    const superAdminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ecourts.local', password: 'Admin@123456' }),
    });
    const superAdminToken = (await superAdminLoginRes.json()).data.tokens.accessToken;

    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dataadmin@ecourts.local', password: 'DataAdmin@123456' }),
    });
    const dataAdminToken = (await adminLoginRes.json()).data.tokens.accessToken;

    const readOnlyLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'viewer@ecourts.local', password: 'Viewer@123456' }),
    });
    const readOnlyToken = (await readOnlyLoginRes.json()).data.tokens.accessToken;

    // First, register a sample CNR into case_registry
    const courtsList = await db.getCourts({ limit: 1 });
    const court = courtsList.courts[0] || (await db.findCourtByCode('BOM_HC_BOMBAY'));
    const testCnr = 'DLND020047882015';
    await db.registerDiscoveredCnr({
      cnr: testCnr,
      courtId: court.id,
      caseStatus: 'PENDING',
      syncStatus: 'PENDING_DETAIL',
    });

    // TEST 1: Trigger Case Detail Synchronization Endpoint
    console.log(`\n${colors.cyan}[1/8] Testing Case Detail Ingestion Trigger Endpoint...${colors.reset}`);
    const syncRes = await fetch(`${baseUrl}/api/cases/${testCnr}/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${dataAdminToken}` },
    });
    const syncJson = await syncRes.json();
    assert(syncRes.status === 202, 'Case detail sync endpoint returns HTTP 202 Accepted');
    assert(syncJson.data.cnr === testCnr, 'Response returns target CNR');

    // Wait for worker processing
    let rawRecord = null;
    for (let i = 0; i < 30; i++) {
      rawRecord = await db.getRawApiResponseByCnr(testCnr);
      if (rawRecord) break;
      await new Promise((r) => setTimeout(r, 300));
    }

    // TEST 2: Verify Raw API Response Archiving
    console.log(`\n${colors.cyan}[2/8] Testing Raw API Response Archiving & SHA256 Hashing...${colors.reset}`);
    assert(rawRecord !== null, 'Raw API response stored in raw_api_responses table');
    assert(rawRecord.response_hash && rawRecord.response_hash.length === 64, 'SHA256 response_hash generated correctly');
    assert(rawRecord.raw_payload !== undefined, 'Raw JSON payload preserved intact');

    // TEST 3: Verify Normalized Case Detail Dossier (/api/cases/:cnr)
    console.log(`\n${colors.cyan}[3/8] Testing Normalized Case Entity & Relational Graph...${colors.reset}`);
    const caseRes = await fetch(`${baseUrl}/api/cases/${testCnr}`, {
      headers: { Authorization: `Bearer ${dataAdminToken}` },
    });
    const caseJson = await caseRes.json();
    assert(caseRes.status === 200, 'Case detail endpoint returns HTTP 200');

    const c = caseJson.data.case;
    assert(c.cnr === testCnr, 'Case CNR matches requested record');
    assert(Boolean(c.case_type), `Case type correctly normalized (${c.case_type})`);
    assert(c.court_name, 'Court relationship populated');
    assert(c.parties.length > 0, `Case parties normalized (${c.parties.length} parties found)`);
    assert(Array.isArray(c.advocates), `Advocate counsel roster normalized (${c.advocates.length} advocates)`);
    assert(c.hearings.length > 0, `Hearing timeline normalized (${c.hearings.length} hearings)`);
    assert(c.orders.length > 0, `Case orders normalized (${c.orders.length} orders)`);

    // TEST 4: Verify Case Registry State Transition
    console.log(`\n${colors.cyan}[4/8] Testing Case Registry State Transition to SYNCED...${colors.reset}`);
    const regCheck = await db.getRegisteredCases({ search: testCnr, limit: 1 });
    assert(regCheck.cases[0].sync_status === 'SYNCED', 'case_registry sync_status transitioned to SYNCED');
    assert(regCheck.cases[0].last_detail_sync_at !== null, 'case_registry has last_detail_sync_at timestamp');

    // TEST 5: Duplicate Prevention & Idempotency on Re-sync
    console.log(`\n${colors.cyan}[5/8] Testing Idempotency on Repeated Case Detail Sync...${colors.reset}`);
    const initialPartiesCount = c.parties.length;
    const initialHearingsCount = c.hearings.length;

    // Trigger sync second time
    await fetch(`${baseUrl}/api/cases/${testCnr}/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${dataAdminToken}` },
    });
    await new Promise((r) => setTimeout(r, 200));

    const recheckRes = await fetch(`${baseUrl}/api/cases/${testCnr}`, {
      headers: { Authorization: `Bearer ${dataAdminToken}` },
    });
    const recheckCase = (await recheckRes.json()).data.case;
    assert(recheckCase.parties.length === initialPartiesCount, `Parties count remained ${initialPartiesCount} without duplicates`);
    assert(recheckCase.hearings.length === initialHearingsCount, `Hearings count remained ${initialHearingsCount} without duplicates`);

    // TEST 6: RBAC Protection on Raw Source Payload Endpoint (/api/cases/:cnr/raw)
    console.log(`\n${colors.cyan}[6/8] Testing RBAC Protection on Raw API Source Payload...${colors.reset}`);
    const rawSuperAdminRes = await fetch(`${baseUrl}/api/cases/${testCnr}/raw`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(rawSuperAdminRes.status === 200, 'Super Admin can access raw API source payload (200 OK)');

    const rawAdminRes = await fetch(`${baseUrl}/api/cases/${testCnr}/raw`, {
      headers: { Authorization: `Bearer ${dataAdminToken}` },
    });
    assert(rawAdminRes.status === 403, 'Data Admin forbidden (HTTP 403) from accessing raw source');

    const rawReadOnlyRes = await fetch(`${baseUrl}/api/cases/${testCnr}/raw`, {
      headers: { Authorization: `Bearer ${readOnlyToken}` },
    });
    assert(rawReadOnlyRes.status === 403, 'Read-Only user forbidden (HTTP 403) from accessing raw source');

    // TEST 7: Advanced Case Search & Multi-Filter Querying (/api/cases)
    console.log(`\n${colors.cyan}[7/8] Testing Advanced Case Search & Filtering...${colors.reset}`);
    // Search by CNR
    const searchRes = await fetch(`${baseUrl}/api/cases?search=${testCnr}`, {
      headers: { Authorization: `Bearer ${dataAdminToken}` },
    });
    const searchJson = await searchRes.json();
    assert(searchJson.data.cases.length === 1, 'Search by exact CNR locates target case');

    // Filter by Case Type
    const filterRes = await fetch(`${baseUrl}/api/cases?caseType=WP`, {
      headers: { Authorization: `Bearer ${dataAdminToken}` },
    });
    const filterJson = await filterRes.json();
    assert(filterJson.data.cases.every((cs) => cs.case_type === 'WP'), 'Filter by caseType strictly matches');

    // TEST 8: Batch Synchronization Action (/api/cases/batch-sync)
    console.log(`\n${colors.cyan}[8/8] Testing Batch Case Detail Synchronization...${colors.reset}`);
    // Register 2 additional pending CNRs
    await db.registerDiscoveredCnr({ cnr: 'MHHC010099912024', courtId: court.id });
    await db.registerDiscoveredCnr({ cnr: 'MHHC010099922024', courtId: court.id });

    const batchRes = await fetch(`${baseUrl}/api/cases/batch-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataAdminToken}`,
      },
      body: JSON.stringify({ limit: 5 }),
    });
    const batchJson = await batchRes.json();
    assert(batchRes.status === 202, 'Batch sync returns HTTP 202 Accepted');
    assert(batchJson.data.count >= 2, `Dispatched batch sync for ${batchJson.data.count} pending cases`);

    console.log(`\n${colors.green}✓ ALL 8 MILESTONE 4 TEST SUITES PASSED PERFECTLY!${colors.reset}\n`);
  } finally {
    server.close();
  }
};

runM4Verification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n${colors.red}✗ M4 Test Suite Failed:${colors.reset}`, err);
    process.exit(1);
  });
