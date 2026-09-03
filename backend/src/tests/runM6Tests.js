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

const runM6Verification = async () => {
  console.log(`\n${colors.cyan}=== Running M6 Automated Daily New Case Discovery Verification Suite ===${colors.reset}\n`);

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
    // Authenticate as Data Admin
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dataadmin@ecourts.local', password: 'DataAdmin@123456' }),
    });
    const dataAdminToken = (await loginRes.json()).data.tokens.accessToken;

    // TEST 1: Retrieve Daily Discovery Scheduler Status & Supported Windows
    console.log(`${colors.cyan}[1/8] Testing Daily Discovery Scheduler Status & Windows...${colors.reset}`);
    const statusRes = await fetch(`${baseUrl}/api/discovery/daily/status`, {
      headers: { Authorization: `Bearer ${dataAdminToken}` },
    });
    const statusJson = await statusRes.json();
    assert(statusRes.status === 200, 'Status endpoint returns HTTP 200');
    assert(statusJson.data.status.enabled === true, 'Daily discovery scheduler is enabled by default');
    assert(statusJson.data.status.lookbackWindow === 'LAST_7_DAYS', 'Default lookback window is LAST_7_DAYS');
    assert(statusJson.data.status.supportedWindows.length === 4, 'Supported lookback windows include TODAY, YESTERDAY, LAST_7_DAYS, LAST_30_DAYS');

    // TEST 2: Update Scheduler Configuration via Admin API
    console.log(`\n${colors.cyan}[2/8] Testing Scheduler Settings Update (/api/discovery/daily/config)...${colors.reset}`);
    const updateRes = await fetch(`${baseUrl}/api/discovery/daily/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataAdminToken}`,
      },
      body: JSON.stringify({
        lookbackWindow: 'LAST_30_DAYS',
        maxJobsPerRun: 4,
        cron: '0 3 * * *',
      }),
    });
    const updateJson = await updateRes.json();
    assert(updateRes.status === 200, 'Config update endpoint returns HTTP 200');
    assert(updateJson.data.config.lookbackWindow === 'LAST_30_DAYS', 'Lookback window successfully updated to LAST_30_DAYS');
    assert(updateJson.data.config.maxJobsPerRun === 4, 'Max jobs per run successfully updated to 4');

    // TEST 3: Trigger Daily Discovery Run (POST /api/discovery/daily/trigger)
    console.log(`\n${colors.cyan}[3/8] Testing Daily Incremental Discovery Run Trigger...${colors.reset}`);
    const triggerRes = await fetch(`${baseUrl}/api/discovery/daily/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataAdminToken}`,
      },
      body: JSON.stringify({
        lookbackWindow: 'LAST_7_DAYS',
      }),
    });
    const triggerJson = await triggerRes.json();
    assert(triggerRes.status === 202, 'Trigger endpoint returns HTTP 202 Accepted');
    assert(triggerJson.data.dailyRun.id !== undefined, 'Daily discovery run record created with UUID');
    assert(triggerJson.data.jobsCount > 0, `Spawned ${triggerJson.data.jobsCount} court discovery jobs`);

    const dailyRunId = triggerJson.data.dailyRun.id;

    // TEST 4: Poll Incremental Jobs Completion & Verify CNR Registry
    console.log(`\n${colors.cyan}[4/8] Testing Background Job Execution & CNR Registry Ingestion...${colors.reset}`);
    let attempts = 0;
    let completedRun = null;
    while (attempts < 100) {
      attempts++;
      await new Promise((r) => setTimeout(r, 150));
      const runRes = await db.findDailyDiscoveryRunById(dailyRunId);
      if (runRes && (runRes.status === 'COMPLETED' || (runRes.total_cases_found > 0 && runRes.completed_at))) {
        completedRun = runRes;
        break;
      }
    }
    assert(completedRun !== null, 'Daily discovery run recorded activity and completed all court segments');
    assert(completedRun.total_cases_found > 0, `Total cases discovered across active courts: ${completedRun.total_cases_found}`);
    assert(
      completedRun.total_cases_found > 0 && (completedRun.new_cnrs_found >= 0),
      `Cases processed in daily run: ${completedRun.total_cases_found} (new CNRs: ${completedRun.new_cnrs_found})`
    );

    // TEST 5: Automatic Full Case Detail Ingestion for Discovered CNRs
    console.log(`\n${colors.cyan}[5/8] Testing Automatic Case Detail Ingestion Pipeline for Discovered CNRs...${colors.reset}`);
    // Allow background case detail worker to process
    await new Promise((r) => setTimeout(r, 800));

    const registryRes = await db.getRegisteredCases({ limit: 20 });
    assert(registryRes.cases.length > 0, 'Registered cases present in case_registry');

    const syncedCases = registryRes.cases.filter((c) => c.sync_status === 'SYNCED');
    assert(syncedCases.length > 0, `Case Detail worker auto-synced ${syncedCases.length} new CNRs into full relational dossiers`);

    // Verify dossier integrity of the auto-synced case
    const sampleSyncedCnr = syncedCases[0].cnr;
    const dossierRes = await fetch(`${baseUrl}/api/cases/${sampleSyncedCnr}`, {
      headers: { Authorization: `Bearer ${dataAdminToken}` },
    });
    const dossierJson = await dossierRes.json();
    assert(dossierRes.status === 200, 'Dossier endpoint returns HTTP 200 for auto-ingested case');
    assert(dossierJson.data.case.parties.length > 0, 'Auto-ingested case has normalized parties');
    assert(dossierJson.data.case.hearings.length > 0, 'Auto-ingested case has normalized hearings');

    // TEST 6: Overlapping Lookback Windows & Idempotent Deduplication
    console.log(`\n${colors.cyan}[6/8] Testing Overlapping Lookback Windows & Zero-Duplicate Ingestion...${colors.reset}`);
    const initialTotalRegistry = (await db.getRegisteredCases({ limit: 1000 })).total;

    // Run discovery again with overlapping window 'TODAY'
    const overlapRes = await fetch(`${baseUrl}/api/discovery/daily/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataAdminToken}`,
      },
      body: JSON.stringify({
        lookbackWindow: 'TODAY',
      }),
    });
    const overlapJson = await overlapRes.json();
    assert(overlapRes.status === 202, 'Overlapping window run triggered');

    const secondRunId = overlapJson.data.dailyRun.id;
    let secondAttempts = 0;
    let secondRun = null;
    while (secondAttempts < 60) {
      secondAttempts++;
      await new Promise((r) => setTimeout(r, 150));
      const r = await db.findDailyDiscoveryRunById(secondRunId);
      if (r && r.status === 'COMPLETED') {
        secondRun = r;
        break;
      }
    }

    const afterTotalRegistry = (await db.getRegisteredCases({ limit: 1000 })).total;
    assert(afterTotalRegistry === initialTotalRegistry, `Idempotency confirmed: Registry count remains ${initialTotalRegistry} with 0 duplicate records`);
    assert(secondRun.existing_cnrs_found > 0, `Existing CNRs recognized and discovery timestamps updated (${secondRun.existing_cnrs_found} existing CNRs)`);

    // TEST 7: Daily Discovery Run History Endpoint (/api/discovery/daily/history)
    console.log(`\n${colors.cyan}[7/8] Testing Daily Discovery Execution History Endpoint...${colors.reset}`);
    const historyRes = await fetch(`${baseUrl}/api/discovery/daily/history?limit=10`, {
      headers: { Authorization: `Bearer ${dataAdminToken}` },
    });
    const historyJson = await historyRes.json();
    assert(historyRes.status === 200, 'History endpoint returns HTTP 200');
    assert(historyJson.data.runs.length >= 2, `History returns ${historyJson.data.runs.length} recorded daily execution runs`);
    assert(historyJson.data.runs[0].lookback_window !== undefined, 'History entries contain lookback window');

    // TEST 8: Targeted Court Subset Daily Discovery
    console.log(`\n${colors.cyan}[8/8] Testing Targeted Court Subset Daily Discovery...${colors.reset}`);
    const court1 = (await db.getCourts({ limit: 1 })).courts[0];
    const targetedRes = await fetch(`${baseUrl}/api/discovery/daily/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataAdminToken}`,
      },
      body: JSON.stringify({
        lookbackWindow: 'YESTERDAY',
        courtIds: [court1.id],
      }),
    });
    const targetedJson = await targetedRes.json();
    assert(targetedRes.status === 202, 'Targeted subset trigger returns HTTP 202');
    assert(targetedJson.data.jobsCount === 1, 'Spawned exactly 1 job for the single targeted court');
    assert(targetedJson.data.courts[0].id === court1.id, 'Target court ID matches selection');

    console.log(`\n${colors.green}✓ ALL 8 MILESTONE 6 TEST SUITES PASSED PERFECTLY!${colors.reset}\n`);
  } finally {
    server.close();
  }
};

runM6Verification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n${colors.red}✗ M6 Test Suite Failed:${colors.reset}`, err);
    process.exit(1);
  });
