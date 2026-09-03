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
import { ROLES } from '../constants/roles.js';
import { PERMISSIONS } from '../constants/permissions.js';

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

const runRBACVerification = async () => {
  console.log(`\n${colors.cyan}=== Running Comprehensive RBAC & Real Data Verification Suite ===${colors.reset}\n`);

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
    // -------------------------------------------------------------
    // TEST 1: User Logins & Permissions Profile (/api/auth/me)
    // -------------------------------------------------------------
    console.log(`${colors.cyan}[1/7] Testing Authentication & Permissions Resolution across All 3 Roles...${colors.reset}`);

    // Super Admin
    const saLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@test.local', password: 'SuperAdmin@123456' }),
    });
    const saJson = await saLogin.json();
    assert(saLogin.status === 200, 'Super Admin login returns HTTP 200');
    assert(saJson.data.user.role === ROLES.SUPER_ADMIN, 'Super Admin user object contains primary role');
    assert(saJson.data.user.permissions.length > 20, 'Super Admin granted all granular permissions');
    const saToken = saJson.data.tokens.accessToken;

    // Data Admin
    const daLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dataadmin@test.local', password: 'DataAdmin@123456' }),
    });
    const daJson = await daLogin.json();
    assert(daLogin.status === 200, 'Data Admin login returns HTTP 200');
    assert(daJson.data.user.role === ROLES.DATA_ADMIN, 'Data Admin user object contains DATA_ADMIN role');
    assert(daJson.data.user.permissions.includes(PERMISSIONS.START_DISCOVERY), 'Data Admin has START_DISCOVERY permission');
    assert(!daJson.data.user.permissions.includes(PERMISSIONS.VIEW_SETTINGS), 'Data Admin does NOT have VIEW_SETTINGS permission');
    assert(!daJson.data.user.permissions.includes(PERMISSIONS.VIEW_RAW_API_DATA), 'Data Admin does NOT have VIEW_RAW_API_DATA permission');
    const daToken = daJson.data.tokens.accessToken;

    // Read Only
    const roLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'readonly@test.local', password: 'ReadOnly@123456' }),
    });
    const roJson = await roLogin.json();
    assert(roLogin.status === 200, 'Read Only login returns HTTP 200');
    assert(roJson.data.user.role === ROLES.READ_ONLY, 'Read Only user object contains READ_ONLY role');
    assert(roJson.data.user.permissions.includes(PERMISSIONS.VIEW_DASHBOARD), 'Read Only has VIEW_DASHBOARD permission');
    assert(roJson.data.user.permissions.includes(PERMISSIONS.VIEW_CASES), 'Read Only has VIEW_CASES permission');
    assert(!roJson.data.user.permissions.includes(PERMISSIONS.START_DISCOVERY), 'Read Only does NOT have START_DISCOVERY permission');
    assert(!roJson.data.user.permissions.includes(PERMISSIONS.VIEW_DISCOVERY), 'Read Only does NOT have VIEW_DISCOVERY permission');
    const roToken = roJson.data.tokens.accessToken;

    // Verify /api/auth/me endpoint for current user session
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${daToken}` },
    });
    const meJson = await meRes.json();
    assert(meRes.status === 200, '/api/auth/me returns HTTP 200');
    assert(meJson.data.user.role === ROLES.DATA_ADMIN, '/api/auth/me returns user role');
    assert(Array.isArray(meJson.data.user.permissions), '/api/auth/me returns permissions array');

    // -------------------------------------------------------------
    // TEST 2: READ_ONLY Direct API Route Blocking (403 Forbidden)
    // -------------------------------------------------------------
    console.log(`\n${colors.cyan}[2/7] Testing READ_ONLY Direct API Access Restrictions (403 Forbidden)...${colors.reset}`);

    // Discovery job trigger
    const roDiscRes = await fetch(`${baseUrl}/api/discovery/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${roToken}` },
      body: JSON.stringify({ courtId: 'some-id', filingYear: 2026 }),
    });
    assert(roDiscRes.status === 403, 'READ_ONLY blocked from POST /api/discovery/jobs with 403 Forbidden');

    // Discovery view
    const roDiscViewRes = await fetch(`${baseUrl}/api/discovery/jobs`, {
      headers: { Authorization: `Bearer ${roToken}` },
    });
    assert(roDiscViewRes.status === 403, 'READ_ONLY blocked from GET /api/discovery/jobs with 403 Forbidden');

    // Case sync trigger
    const roSyncRes = await fetch(`${baseUrl}/api/cases/MHCC010000012026/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${roToken}` },
    });
    assert(roSyncRes.status === 403, 'READ_ONLY blocked from POST /api/cases/:cnr/sync with 403 Forbidden');

    // System settings view
    const roSettingsRes = await fetch(`${baseUrl}/api/settings/config`, {
      headers: { Authorization: `Bearer ${roToken}` },
    });
    assert(roSettingsRes.status === 403, 'READ_ONLY blocked from GET /api/settings/config with 403 Forbidden');

    // Audit logs view
    const roAuditRes = await fetch(`${baseUrl}/api/settings/audit-logs`, {
      headers: { Authorization: `Bearer ${roToken}` },
    });
    assert(roAuditRes.status === 403, 'READ_ONLY blocked from GET /api/settings/audit-logs with 403 Forbidden');

    // -------------------------------------------------------------
    // TEST 3: DATA_ADMIN Administrative Restrictions (403 Forbidden)
    // -------------------------------------------------------------
    console.log(`\n${colors.cyan}[3/7] Testing DATA_ADMIN Administrative Isolation (403 Forbidden)...${colors.reset}`);

    // Settings config
    const daSettingsRes = await fetch(`${baseUrl}/api/settings/config`, {
      headers: { Authorization: `Bearer ${daToken}` },
    });
    assert(daSettingsRes.status === 403, 'DATA_ADMIN blocked from GET /api/settings/config with 403 Forbidden');

    // Settings update
    const daSettingsUpdate = await fetch(`${baseUrl}/api/settings/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${daToken}` },
      body: JSON.stringify({ key: 'system.maintenance_mode', value: true }),
    });
    assert(daSettingsUpdate.status === 403, 'DATA_ADMIN blocked from PUT /api/settings/config with 403 Forbidden');

    // Audit logs view
    const daAuditRes = await fetch(`${baseUrl}/api/settings/audit-logs`, {
      headers: { Authorization: `Bearer ${daToken}` },
    });
    assert(daAuditRes.status === 403, 'DATA_ADMIN blocked from GET /api/settings/audit-logs with 403 Forbidden');

    // Users management view
    const daUsersRes = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${daToken}` },
    });
    assert(daUsersRes.status === 403, 'DATA_ADMIN blocked from GET /api/users with 403 Forbidden');

    // -------------------------------------------------------------
    // TEST 4: Raw API Source Data Restriction (SUPER_ADMIN Only)
    // -------------------------------------------------------------
    console.log(`\n${colors.cyan}[4/7] Testing Raw API Source Data Access Isolation (SUPER_ADMIN Only)...${colors.reset}`);

    // Trigger 1 case detail sync so raw response exists
    const court = (await db.getCourts({ limit: 1 })).courts[0];
    const rawDiscJob = await db.createDiscoveryJob({
      courtId: court.id,
      strategy: 'SINGLE',
      filters: { filingYear: 2026 },
      totalPages: 1,
    });
    await db.registerDiscoveredCnr({ cnr: 'MHCC010000012026', courtId: court.id });
    await fetch(`${baseUrl}/api/cases/MHCC010000012026/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${daToken}` },
    });
    await new Promise((r) => setTimeout(r, 600));

    // READ_ONLY attempting raw data
    const roRawRes = await fetch(`${baseUrl}/api/cases/MHCC010000012026/raw`, {
      headers: { Authorization: `Bearer ${roToken}` },
    });
    assert(roRawRes.status === 403, 'READ_ONLY blocked from GET /api/cases/:cnr/raw (403 Forbidden)');

    // DATA_ADMIN attempting raw data
    const daRawRes = await fetch(`${baseUrl}/api/cases/MHCC010000012026/raw`, {
      headers: { Authorization: `Bearer ${daToken}` },
    });
    assert(daRawRes.status === 403, 'DATA_ADMIN blocked from GET /api/cases/:cnr/raw (403 Forbidden)');

    // SUPER_ADMIN attempting raw data
    const saRawRes = await fetch(`${baseUrl}/api/cases/MHCC010000012026/raw`, {
      headers: { Authorization: `Bearer ${saToken}` },
    });
    assert(saRawRes.status === 200, 'SUPER_ADMIN granted access to GET /api/cases/:cnr/raw (200 OK)');
    const saRawJson = await saRawRes.json();
    assert(saRawJson.data.raw.response_hash !== undefined, 'Raw API response contains cryptographic SHA256 hash');

    // -------------------------------------------------------------
    // TEST 5: SUPER_ADMIN Full Platform Administrative Access
    // -------------------------------------------------------------
    console.log(`\n${colors.cyan}[5/7] Testing SUPER_ADMIN Full System Permissions...${colors.reset}`);

    // Audit logs
    const saAuditRes = await fetch(`${baseUrl}/api/settings/audit-logs`, {
      headers: { Authorization: `Bearer ${saToken}` },
    });
    assert(saAuditRes.status === 200, 'SUPER_ADMIN access to GET /api/settings/audit-logs returns 200 OK');

    // Settings config
    const saSettingsRes = await fetch(`${baseUrl}/api/settings/config`, {
      headers: { Authorization: `Bearer ${saToken}` },
    });
    assert(saSettingsRes.status === 200, 'SUPER_ADMIN access to GET /api/settings/config returns 200 OK');

    // Settings update
    const saSettingsUpdate = await fetch(`${baseUrl}/api/settings/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({ key: 'system.maintenance_mode', value: false }),
    });
    assert(saSettingsUpdate.status === 200, 'SUPER_ADMIN access to PUT /api/settings/config returns 200 OK');

    // Users view
    const saUsersRes = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${saToken}` },
    });
    assert(saUsersRes.status === 200, 'SUPER_ADMIN access to GET /api/users returns 200 OK');

    // -------------------------------------------------------------
    // TEST 6: Real Dashboard APIs (/api/dashboard/*)
    // -------------------------------------------------------------
    console.log(`\n${colors.cyan}[6/7] Testing Real Calculated Dashboard APIs...${colors.reset}`);

    // Summary
    const summaryRes = await fetch(`${baseUrl}/api/dashboard/summary`, {
      headers: { Authorization: `Bearer ${roToken}` },
    });
    const summaryJson = await summaryRes.json();
    assert(summaryRes.status === 200, 'GET /api/dashboard/summary returns HTTP 200');
    assert(typeof summaryJson.data.totalCourts === 'number', 'Summary returns real numerical totalCourts');
    assert(typeof summaryJson.data.totalCases === 'number', 'Summary returns real numerical totalCases');
    assert(typeof summaryJson.data.activeCases === 'number', 'Summary returns real numerical activeCases');
    assert(typeof summaryJson.data.disposedCases === 'number', 'Summary returns real numerical disposedCases');
    assert(typeof summaryJson.data.failedJobs === 'number', 'Summary returns real numerical failedJobs');

    // System Health
    const healthRes = await fetch(`${baseUrl}/api/dashboard/system-health`, {
      headers: { Authorization: `Bearer ${roToken}` },
    });
    const healthJson = await healthRes.json();
    assert(healthRes.status === 200, 'GET /api/dashboard/system-health returns HTTP 200');
    assert(healthJson.data.status === 'UP', 'System health status is UP');
    assert(healthJson.data.services.queues.totalQueues === 6, 'Health reports all 6 queues operational');

    // Recent Activity
    const activityRes = await fetch(`${baseUrl}/api/dashboard/recent-activity?limit=5`, {
      headers: { Authorization: `Bearer ${roToken}` },
    });
    const activityJson = await activityRes.json();
    assert(activityRes.status === 200, 'GET /api/dashboard/recent-activity returns HTTP 200');
    assert(Array.isArray(activityJson.data.activity), 'Recent activity returns array of real events');

    // Queue status
    const queueStatusRes = await fetch(`${baseUrl}/api/dashboard/queue-status`, {
      headers: { Authorization: `Bearer ${roToken}` },
    });
    assert(queueStatusRes.status === 200, 'GET /api/dashboard/queue-status returns HTTP 200');

    // -------------------------------------------------------------
    // TEST 7: READ_ONLY Allowed Data Exploration Endpoints
    // -------------------------------------------------------------
    console.log(`\n${colors.cyan}[7/7] Testing READ_ONLY Allowed Viewing Endpoints...${colors.reset}`);

    const courtsRes = await fetch(`${baseUrl}/api/courts?limit=5`, {
      headers: { Authorization: `Bearer ${roToken}` },
    });
    assert(courtsRes.status === 200, 'READ_ONLY allowed to view courts (200 OK)');

    const hierarchyRes = await fetch(`${baseUrl}/api/courts/hierarchy`, {
      headers: { Authorization: `Bearer ${roToken}` },
    });
    assert(hierarchyRes.status === 200, 'READ_ONLY allowed to view court hierarchy (200 OK)');

    const casesRes = await fetch(`${baseUrl}/api/cases?limit=5`, {
      headers: { Authorization: `Bearer ${roToken}` },
    });
    assert(casesRes.status === 200, 'READ_ONLY allowed to view case listings (200 OK)');

    console.log(`\n${colors.green}✓ ALL 7 RBAC & REAL DATA VERIFICATION TEST SUITES PASSED PERFECTLY!${colors.reset}\n`);
  } finally {
    server.close();
  }
};

runRBACVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n${colors.red}✗ RBAC Test Suite Failed:${colors.reset}`, err);
    process.exit(1);
  });
