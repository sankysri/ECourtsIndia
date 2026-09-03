import app from '../app.js';
import { testDbConnection } from '../config/database.js';
import { runMigrations } from '../database/migrate.js';
import { seedDatabase } from '../database/seed.js';
import { initQueues, drainAllQueues } from '../queues/queueManager.js';
import { initSampleWorkers } from '../workers/sampleWorker.js';
import { initCourtSyncWorker } from '../workers/courtSyncWorker.js';
import { ecourtsClient } from '../services/ecourtsIndia/ecourtsIndiaClient.js';
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

const runM2Verification = async () => {
  console.log(`\n${colors.cyan}=== Running M2 eCourtsIndia API Client & Court Master Verification Suite ===${colors.reset}\n`);

  // 1. Initialize environment
  await testDbConnection();
  await runMigrations();
  await seedDatabase();
  initQueues();
  await drainAllQueues();
  initSampleWorkers();
  initCourtSyncWorker();
  await RateLimiter.reset();

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Authenticate as Super Admin
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ecourts.local', password: 'Admin@123456' }),
    });
    const adminToken = (await loginRes.json()).data.tokens.accessToken;

    // Authenticate as Data Admin
    const dataAdminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dataadmin@ecourts.local', password: 'DataAdmin@123456' }),
    });
    const dataAdminToken = (await dataAdminLoginRes.json()).data.tokens.accessToken;

    // TEST 1: Central API Client Execution & Error Normalization
    console.log(`${colors.cyan}[1/8] Testing Central eCourtsIndia API Client...${colors.reset}`);
    const clientRes = await ecourtsClient.request({
      endpoint: '/courts/master',
      method: 'GET',
      courtCode: 'BOM_HC_BOMBAY',
    });
    assert(clientRes.success === true, 'Central API Client returns structured response payload');
    assert(clientRes.data.states.length > 0, 'Central API Client retrieves states and courts');

    // TEST 2: Dynamic Redis Rate Limiter
    console.log(`\n${colors.cyan}[2/8] Testing Central Rate Limiter with Dynamic System Settings...${colors.reset}`);
    const limits = await RateLimiter.getDynamicLimits();
    assert(limits.perMinute >= 60, 'Rate limiter reads api_requests_per_minute from system_settings');
    assert(limits.maxConcurrent >= 5, 'Rate limiter reads api_max_concurrent_requests from system_settings');

    const tokenAcquired = await RateLimiter.acquire();
    assert(tokenAcquired.allowed === true, 'Rate limit token acquired successfully');
    await RateLimiter.release();

    // TEST 3: API Request Logging (api_request_logs)
    console.log(`\n${colors.cyan}[3/8] Testing API Request Logs Generation & Persistence...${colors.reset}`);
    const logs = await db.getApiRequestLogs({ limit: 10 });
    assert(logs.length > 0, 'api_request_logs table populated with API call metadata');
    assert(logs[0].endpoint, 'Request log contains endpoint');
    assert(logs[0].response_time_ms >= 0, 'Request log contains latency metrics');
    assert(logs[0].estimated_cost >= 0, 'Request log contains estimated cost calculation');

    // TEST 4: Asynchronous Court Sync Action via BullMQ (POST /api/courts/sync)
    console.log(`\n${colors.cyan}[4/8] Testing Asynchronous Court Synchronization Action...${colors.reset}`);
    const syncTriggerRes = await fetch(`${baseUrl}/api/courts/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${dataAdminToken}` },
    });
    const syncTriggerJson = await syncTriggerRes.json();
    assert(syncTriggerRes.status === 202, 'Sync endpoint returns HTTP 202 Accepted');
    assert(syncTriggerJson.data.jobId, 'Sync endpoint returns jobId');

    const jobId = syncTriggerJson.data.jobId;

    // Poll status until completion (up to 50 attempts)
    let isComplete = false;
    let attempts = 0;
    let finalStatus = null;
    while (!isComplete && attempts < 50) {
      attempts++;
      await new Promise((r) => setTimeout(r, 100));
      const statusRes = await fetch(`${baseUrl}/api/courts/sync/status/${jobId}`, {
        headers: { Authorization: `Bearer ${dataAdminToken}` },
      });
      const statusJson = await statusRes.json();
      finalStatus = statusJson.data.syncJob;
      if (finalStatus?.status === 'COMPLETED') {
        isComplete = true;
      }
    }
    assert(isComplete === true, 'Asynchronous Court Sync worker transitions to COMPLETED');
    assert(finalStatus?.result?.courtsSynced > 0, 'Court sync result reports courts synced');
    assert(finalStatus?.result?.statesSynced > 0, 'Court sync result reports states synced');

    // TEST 5: Idempotency & Duplicate Prevention
    console.log(`\n${colors.cyan}[5/8] Testing Duplicate Prevention on Repeated Sync...${colors.reset}`);
    const initialCourtsRes = await fetch(`${baseUrl}/api/courts?limit=100`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const initialCount = (await initialCourtsRes.json()).data.total;

    // Trigger sync second time
    const secondSyncRes = await fetch(`${baseUrl}/api/courts/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const secondJobId = (await secondSyncRes.json()).data.jobId;

    let secondComplete = false;
    let secondAttempts = 0;
    while (!secondComplete && secondAttempts < 50) {
      secondAttempts++;
      await new Promise((r) => setTimeout(r, 100));
      const statusRes = await fetch(`${baseUrl}/api/courts/sync/status/${secondJobId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const statusJson = await statusRes.json();
      if (statusJson.data.syncJob?.status === 'COMPLETED') {
        secondComplete = true;
      }
    }

    const afterSyncCourtsRes = await fetch(`${baseUrl}/api/courts?limit=100`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const afterCount = (await afterSyncCourtsRes.json()).data.total;
    assert(afterCount === initialCount, `Idempotency verified: Total courts remain ${initialCount} with 0 duplicates`);

    // TEST 6: Dynamic Enum & Capabilities Endpoint (/api/courts/metadata)
    console.log(`\n${colors.cyan}[6/8] Testing Dynamic Metadata & Reference Enums...${colors.reset}`);
    const metaRes = await fetch(`${baseUrl}/api/courts/metadata`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const metaJson = await metaRes.json();
    assert(metaRes.status === 200, 'Metadata endpoint returns HTTP 200');
    assert(metaJson.data.states.length > 0, 'Metadata returns synchronized states list');
    assert(metaJson.data.enums.court_types.length > 0, 'Metadata returns dynamic court_types');
    assert(metaJson.data.enums.case_types.length > 0, 'Metadata returns dynamic case_types');
    assert(metaJson.data.enums.case_statuses.length > 0, 'Metadata returns dynamic case_statuses');

    // TEST 7: Court Master Querying, Search, Filtering & Hierarchy
    console.log(`\n${colors.cyan}[7/8] Testing Court Master Search, Filter & Hierarchy Endpoints...${colors.reset}`);
    // Search by name
    const searchRes = await fetch(`${baseUrl}/api/courts?search=Bombay`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const searchJson = await searchRes.json();
    assert(searchJson.data.courts.length > 0, 'Search by keyword returns matching court records');

    // Filter by State
    const filterStateRes = await fetch(`${baseUrl}/api/courts?state=DL`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const filterStateJson = await filterStateRes.json();
    assert(filterStateJson.data.courts.every((c) => c.state_code === 'DL'), 'State filter strictly matches target state');

    // Hierarchy tree
    const hierarchyRes = await fetch(`${baseUrl}/api/courts/hierarchy`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const hierarchyJson = await hierarchyRes.json();
    assert(hierarchyJson.data.hierarchy.length > 0, 'Hierarchy endpoint returns nested state/district/court tree');

    // TEST 8: Court Detail & API Logs (/api/courts/:id)
    console.log(`\n${colors.cyan}[8/8] Testing Court Detail & Associated API Logs...${colors.reset}`);
    const sampleCourt = searchJson.data.courts[0];
    const detailRes = await fetch(`${baseUrl}/api/courts/${sampleCourt.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const detailJson = await detailRes.json();
    assert(detailRes.status === 200, 'Court Detail returns HTTP 200');
    assert(detailJson.data.court.code === sampleCourt.code, 'Court detail matches requested court ID');

    const courtLogsRes = await fetch(`${baseUrl}/api/courts/${sampleCourt.code}/logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(courtLogsRes.status === 200, 'Court API Logs returns HTTP 200');

    console.log(`\n${colors.green}✓ ALL 8 MILESTONE 2 TEST SUITES PASSED PERFECTLY!${colors.reset}\n`);
  } finally {
    server.close();
  }
};

runM2Verification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n${colors.red}✗ M2 Test Suite Failed:${colors.reset}`, err);
    process.exit(1);
  });
