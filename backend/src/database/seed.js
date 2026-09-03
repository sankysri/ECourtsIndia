import bcrypt from 'bcryptjs';
import { db } from './datastore.js';
import { logger } from '../utils/logger.js';
import { testDbConnection } from '../config/database.js';
import { env } from '../config/env.js';

export const seedDatabase = async () => {
  logger.info('Seeding database with roles, permissions, default users, and system settings...');
  await testDbConnection();

  // 1. Seed Roles
  const roles = [
    { name: 'SUPER_ADMIN', description: 'Full administrative access to all platform resources and configuration.' },
    { name: 'DATA_ADMIN', description: 'Operational control over data discovery, sync pipelines, and queues.' },
    { name: 'READ_ONLY', description: 'Read-only access to courts, cases, documents, and reporting dashboards.' },
  ];

  for (const role of roles) {
    await db.createRole(role);
  }

  // 2. Seed Permissions
  const permissions = [
    { name: 'courts:read', module: 'courts', description: 'View court establishments and judges' },
    { name: 'courts:write', module: 'courts', description: 'Create and edit court structures' },
    { name: 'courts:sync', module: 'courts', description: 'Trigger and monitor court hierarchy synchronization' },
    { name: 'cases:read', module: 'cases', description: 'View case metadata and proceedings' },
    { name: 'cases:write', module: 'cases', description: 'Modify case records' },
    { name: 'discovery:manage', module: 'discovery', description: 'Trigger and manage case discovery jobs' },
    { name: 'sync:manage', module: 'sync', description: 'Trigger and control data sync pipelines' },
    { name: 'queues:manage', module: 'queues', description: 'Monitor, pause, and dispatch queue jobs' },
    { name: 'settings:manage', module: 'settings', description: 'Modify global platform settings' },
  ];

  for (const perm of permissions) {
    await db.createPermission(perm);
    await db.assignPermissionToRole('SUPER_ADMIN', perm.name);
  }

  // Assign selective permissions to DATA_ADMIN
  const dataAdminPerms = ['courts:read', 'courts:write', 'courts:sync', 'cases:read', 'cases:write', 'discovery:manage', 'sync:manage', 'queues:manage'];
  for (const p of dataAdminPerms) {
    await db.assignPermissionToRole('DATA_ADMIN', p);
  }

  // Assign read permissions to READ_ONLY
  const readOnlyPerms = ['courts:read', 'cases:read'];
  for (const p of readOnlyPerms) {
    await db.assignPermissionToRole('READ_ONLY', p);
  }

  // 3. Seed Default Users
  const adminEmail = 'admin@ecourts.local';
  const existingAdmin = await db.findUserByEmail(adminEmail);

  let adminUser = existingAdmin;
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Admin@123456', 10);
    adminUser = await db.createUser(
      {
        email: adminEmail,
        password_hash: passwordHash,
        first_name: 'System',
        last_name: 'Administrator',
        is_active: true,
      },
      ['SUPER_ADMIN']
    );
    logger.info(`Default Super Admin created: ${adminEmail} (password: Admin@123456)`);
  }

  const dataAdminEmail = 'dataadmin@ecourts.local';
  if (!(await db.findUserByEmail(dataAdminEmail))) {
    const passwordHash = await bcrypt.hash('DataAdmin@123456', 10);
    await db.createUser(
      {
        email: dataAdminEmail,
        password_hash: passwordHash,
        first_name: 'Data',
        last_name: 'Operator',
        is_active: true,
      },
      ['DATA_ADMIN']
    );
  }

  const viewerEmail = 'viewer@ecourts.local';
  if (!(await db.findUserByEmail(viewerEmail))) {
    const passwordHash = await bcrypt.hash('Viewer@123456', 10);
    await db.createUser(
      {
        email: viewerEmail,
        password_hash: passwordHash,
        first_name: 'Legal',
        last_name: 'Researcher',
        is_active: true,
      },
      ['READ_ONLY']
    );
  }

  // Seed test role accounts (superadmin@test.local, dataadmin@test.local, readonly@test.local)
  const testSuperAdmin = 'superadmin@test.local';
  if (!(await db.findUserByEmail(testSuperAdmin))) {
    const passwordHash = await bcrypt.hash('SuperAdmin@123456', 10);
    await db.createUser(
      {
        email: testSuperAdmin,
        password_hash: passwordHash,
        first_name: 'Super',
        last_name: 'Admin',
        is_active: true,
      },
      ['SUPER_ADMIN']
    );
  }

  const testDataAdmin = 'dataadmin@test.local';
  if (!(await db.findUserByEmail(testDataAdmin))) {
    const passwordHash = await bcrypt.hash('DataAdmin@123456', 10);
    await db.createUser(
      {
        email: testDataAdmin,
        password_hash: passwordHash,
        first_name: 'Data',
        last_name: 'Admin',
        is_active: true,
      },
      ['DATA_ADMIN']
    );
  }

  const testReadOnly = 'readonly@test.local';
  if (!(await db.findUserByEmail(testReadOnly))) {
    const passwordHash = await bcrypt.hash('ReadOnly@123456', 10);
    await db.createUser(
      {
        email: testReadOnly,
        password_hash: passwordHash,
        first_name: 'Read',
        last_name: 'Only',
        is_active: true,
      },
      ['READ_ONLY']
    );
  }

  // 4. Seed Default System Settings (including M2 Rate Limiting & M6 Daily Discovery Parameters)
  const defaultSettings = [
    { key: 'api_requests_per_minute', value: 600, description: 'Maximum requests allowed per minute to eCourts API', isPublic: true },
    { key: 'api_requests_per_hour', value: 10000, description: 'Maximum requests allowed per hour to eCourts API', isPublic: true },
    { key: 'api_requests_per_day', value: 50000, description: 'Maximum requests allowed per 24 hours to eCourts API', isPublic: true },
    { key: 'api_max_concurrent_requests', value: 25, description: 'Maximum simultaneous in-flight requests to eCourts API', isPublic: true },
    { key: 'ecourts_api_base_url', value: env.ECOURTS_API_BASE_URL || 'https://webapi.ecourtsindia.com', description: 'Upstream eCourts REST API Base URL', isPublic: true },
    { key: 'ecourts_api_key', value: env.ECOURTS_API_KEY || 'eci_live_i419y6eszthgyzpxp2ysnjbusqbwqlnn', description: 'Production eCourts API Secret Key', isPublic: true },
    { key: 'ecourts_use_mock', value: env.ECOURTS_USE_MOCK, description: 'Force mock simulation adapter instead of live upstream HTTP calls', isPublic: true },
    { key: 'sync.batch_size', value: 50, description: 'Default batch size for case synchronization', isPublic: true },
    { key: 'discovery.auto_schedule_enabled', value: true, description: 'Automatic daily discovery scheduler status', isPublic: true },
    { key: 'daily_discovery_enabled', value: true, description: 'Enable automatic incremental daily case discovery', isPublic: true },
    { key: 'daily_discovery_lookback_window', value: 'LAST_7_DAYS', description: 'Default lookback window (TODAY, YESTERDAY, LAST_7_DAYS, LAST_30_DAYS)', isPublic: true },
    { key: 'daily_discovery_cron', value: '0 2 * * *', description: 'Cron expression for daily scheduled runs (Default: 2:00 AM)', isPublic: true },
    { key: 'daily_discovery_active_courts_only', value: true, description: 'Scan active courts only', isPublic: true },
    { key: 'daily_discovery_max_jobs_per_run', value: 20, description: 'Maximum discovery jobs spawned per daily run', isPublic: true },
    { key: 'queue.max_retry_attempts', value: 3, description: 'Maximum retry attempts for failed queue jobs', isPublic: false },
    { key: 'system.maintenance_mode', value: false, description: 'Global system maintenance mode flag', isPublic: true },
    { key: 'storage.s3_archive_enabled', value: true, description: 'Store raw court judgment PDFs in AWS S3', isPublic: false },
  ];

  for (const s of defaultSettings) {
    await db.setSetting(s.key, s.value, s.description, s.isPublic);
  }

  // 5. Seed Initial Dynamic Reference Enums (M2)
  const referenceEnums = [
    // Court Types
    { category: 'court_types', code: 'HIGH_COURT', label: 'High Court', metadata: { jurisdiction: 'State / Constitutional' } },
    { category: 'court_types', code: 'DISTRICT_COURT', label: 'District & Sessions Court', metadata: { jurisdiction: 'District / Principal' } },
    { category: 'court_types', code: 'CITY_CIVIL_COURT', label: 'City Civil Court', metadata: { jurisdiction: 'Metropolitan Civil' } },
    { category: 'court_types', code: 'CHIEF_METROPOLITAN_MAGISTRATE', label: 'Chief Metropolitan Magistrate', metadata: { jurisdiction: 'Metropolitan Criminal' } },
    { category: 'court_types', code: 'FAMILY_COURT', label: 'Family Court', metadata: { jurisdiction: 'Matrimonial & Guardianship' } },
    { category: 'court_types', code: 'COMMERCIAL_COURT', label: 'Commercial Court', metadata: { jurisdiction: 'Commercial Disputes Act' } },
    { category: 'court_types', code: 'TRIBUNAL', label: 'Specialized Tribunal (MACT / DRT / NCLT)', metadata: { jurisdiction: 'Statutory Tribunal' } },

    // Case Types
    { category: 'case_types', code: 'WP', label: 'Writ Petition (Civil / Criminal)', metadata: { priority: 'HIGH' } },
    { category: 'case_types', code: 'CS', label: 'Civil Suit (Original)', metadata: { priority: 'NORMAL' } },
    { category: 'case_types', code: 'CC', label: 'Criminal Case / Calendar Case', metadata: { priority: 'NORMAL' } },
    { category: 'case_types', code: 'BAIL_APPL', label: 'Bail Application', metadata: { priority: 'URGENT' } },
    { category: 'case_types', code: 'ARB_PET', label: 'Arbitration Petition', metadata: { priority: 'NORMAL' } },
    { category: 'case_types', code: 'CONT_CAS', label: 'Contempt Case', metadata: { priority: 'HIGH' } },
    { category: 'case_types', code: 'EXEC_PET', label: 'Execution Petition', metadata: { priority: 'NORMAL' } },

    // Case Statuses
    { category: 'case_statuses', code: 'PENDING', label: 'Pending Adjudication', metadata: { active: true } },
    { category: 'case_statuses', code: 'DISPOSED', label: 'Disposed / Decided', metadata: { active: false } },
    { category: 'case_statuses', code: 'QUASHED', label: 'Quashed / Dismissed at Admission', metadata: { active: false } },
    { category: 'case_statuses', code: 'TRANSFERRED', label: 'Transferred to Other Bench', metadata: { active: false } },
    { category: 'case_statuses', code: 'STAYED', label: 'Interim Stay Granted', metadata: { active: true } },

    // Search Filters
    { category: 'search_filters', code: 'CNR_NUMBER', label: '16-Digit CNR Number', metadata: { format: 'Alphanumeric(16)' } },
    { category: 'search_filters', code: 'CASE_NUMBER', label: 'Case Number & Registration Year', metadata: { format: 'Type/Number/Year' } },
    { category: 'search_filters', code: 'PARTY_NAME', label: 'Petitioner / Respondent Name', metadata: { format: 'Text String' } },
    { category: 'search_filters', code: 'ADVOCATE_NAME', label: 'Advocate / Bar Reg Number', metadata: { format: 'Text String' } },
    { category: 'search_filters', code: 'ACT_SECTION', label: 'Statute Act & Section', metadata: { format: 'Act and Section code' } },
  ];

  for (const item of referenceEnums) {
    await db.upsertApiEnum(item);
  }

  // 6. Initial Seed Audit Log
  await db.createAuditLog({
    userId: adminUser?.id,
    action: 'SYSTEM_INITIALIZED',
    entity: 'PLATFORM',
    entityId: 'SYSTEM_FOUNDATION',
    details: { version: '1.0.0' },
    ipAddress: '127.0.0.1',
    userAgent: 'System Bootstrapper',
  });

  logger.info('Database seeding completed successfully.');
  return { success: true };
};

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Database seeding failed', err);
      process.exit(1);
    });
}
