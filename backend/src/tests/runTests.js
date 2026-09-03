import app from '../app.js';
import { testDbConnection } from '../config/database.js';
import { runMigrations } from '../database/migrate.js';
import { seedDatabase } from '../database/seed.js';
import { initQueues } from '../queues/queueManager.js';
import { initSampleWorkers } from '../workers/sampleWorker.js';
import { logger } from '../utils/logger.js';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ${colors.green}✓${colors.reset} ${message}`);
};

const runAllTests = async () => {
  console.log(`\n${colors.cyan}=== Running M1 Backend Verification Suite ===${colors.reset}\n`);

  // 1. Setup DB & Queues
  await testDbConnection();
  await runMigrations();
  await seedDatabase();
  initQueues();
  initSampleWorkers();

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // TEST 1: Health Endpoint (GET /health)
    console.log(`${colors.cyan}[1/7] Testing Health Check Endpoint...${colors.reset}`);
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthJson = await healthRes.json();
    assert(healthRes.status === 200, 'Health endpoint responds with HTTP 200');
    assert(healthJson.success === true, 'Health payload has success: true');
    assert(healthJson.data.services.queues.totalQueues === 6, 'All 6 BullMQ Queues are registered');
    assert(healthJson.data.services.database.name === 'PostgreSQL', 'PostgreSQL database service status present');
    assert(healthJson.data.services.redis.name === 'Redis', 'Redis service status present');

    // TEST 2: Valid Authentication & Token Generation
    console.log(`\n${colors.cyan}[2/7] Testing User Login with Seeded Super Admin...${colors.reset}`);
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ecourts.local', password: 'Admin@123456' }),
    });
    const loginJson = await loginRes.json();
    assert(loginRes.status === 200, 'Admin login succeeds with HTTP 200');
    assert(loginJson.data.tokens.accessToken, 'Access token generated');
    assert(loginJson.data.tokens.refreshToken, 'Refresh token generated');
    assert(loginJson.data.user.roles.includes('SUPER_ADMIN'), 'User has SUPER_ADMIN role');

    const adminToken = loginJson.data.tokens.accessToken;
    const adminRefreshToken = loginJson.data.tokens.refreshToken;

    // TEST 3: Invalid Login Rejection
    console.log(`\n${colors.cyan}[3/7] Testing Invalid Login Handling...${colors.reset}`);
    const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@ecourts.local', password: 'WrongPassword' }),
    });
    const badLoginJson = await badLoginRes.json();
    assert(badLoginRes.status === 401, 'Bad password rejected with HTTP 401');
    assert(badLoginJson.success === false, 'Error response follows standard error envelope');
    assert(badLoginJson.error.code === 'INVALID_CREDENTIALS', 'Error code is INVALID_CREDENTIALS');

    // TEST 4: Token Refresh Architecture
    console.log(`\n${colors.cyan}[4/7] Testing Refresh Token Exchange...${colors.reset}`);
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: adminRefreshToken }),
    });
    const refreshJson = await refreshRes.json();
    assert(refreshRes.status === 200, 'Token refreshed with HTTP 200');
    assert(refreshJson.data.tokens.accessToken, 'New access token generated from refresh token');

    // TEST 5: Protected Route & Current User Profile (/api/auth/me)
    console.log(`\n${colors.cyan}[5/7] Testing Protected Routes & Profile Introspection...${colors.reset}`);
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const meJson = await meRes.json();
    assert(meRes.status === 200, 'Protected /api/auth/me returns HTTP 200');
    assert(meJson.data.user.email === 'admin@ecourts.local', 'Profile matches authenticated user');

    // Unauthenticated rejection
    const unauthRes = await fetch(`${baseUrl}/api/auth/me`);
    assert(unauthRes.status === 401, 'Unauthenticated request rejected with HTTP 401');

    // TEST 6: RBAC & Data Admin vs Read Only Roles
    console.log(`\n${colors.cyan}[6/7] Testing Role-Based Access Control (RBAC)...${colors.reset}`);
    const viewerLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'viewer@ecourts.local', password: 'Viewer@123456' }),
    });
    const viewerToken = (await viewerLoginRes.json()).data.tokens.accessToken;

    // Read only user attempting to view super admin audit logs
    const forbiddenAuditRes = await fetch(`${baseUrl}/api/settings/audit-logs`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    assert(forbiddenAuditRes.status === 403, 'Read-only user forbidden from Super Admin audit logs (HTTP 403)');

    // Super Admin accessing audit logs
    const adminAuditRes = await fetch(`${baseUrl}/api/settings/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminAuditJson = await adminAuditRes.json();
    assert(adminAuditRes.status === 200, 'Super admin successfully accesses audit logs (HTTP 200)');
    assert(adminAuditJson.data.logs.length > 0, 'Audit logs contain recorded authentication and init events');

    // TEST 7: Queue Dispatch & Sample Worker Execution
    console.log(`\n${colors.cyan}[7/7] Testing BullMQ Queue Test Job Dispatch & Telemetry...${colors.reset}`);
    const queueJobRes = await fetch(`${baseUrl}/api/queues/test-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        queueName: 'caseDiscoveryQueue',
        payload: { testState: 'Maharashtra', targetCourt: 'High Court of Bombay' },
      }),
    });
    const queueJobJson = await queueJobRes.json();
    assert(queueJobRes.status === 202, 'Queue test job dispatched with HTTP 202');
    assert(queueJobJson.data.job.jobId, 'Job ID returned from queue dispatcher');

    // Verify queue telemetry in status endpoint
    const queueStatusRes = await fetch(`${baseUrl}/api/queues/status`);
    const queueStatusJson = await queueStatusRes.json();
    assert(queueStatusJson.data.totalQueues === 6, 'Queue status reports 6 queues');
    assert(queueStatusJson.data.telemetry.totalDispatched >= 1, 'Queue telemetry records dispatched test jobs');

    console.log(`\n${colors.green}✓ ALL 7 BACKEND TEST SUITES PASSED PERFECTLY!${colors.reset}\n`);
  } finally {
    server.close();
  }
};

runAllTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n${colors.red}✗ Test Suite Failed:${colors.reset}`, err);
    process.exit(1);
  });
