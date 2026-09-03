import { db } from '../../database/datastore.js';
import { getQueueHealth } from '../../queues/queueManager.js';
import { isRedisConnected } from '../../config/redis.js';
import { isDbConnected } from '../../config/database.js';

export class DashboardService {
  /**
   * Summary aggregates for platform dashboard
   */
  static async getSummary() {
    // 1. Total courts count
    const courtsResult = await db.getCourts({ limit: 1 });
    const totalCourts = courtsResult.total || 0;

    // 2. Cases registry count & breakdown
    const registryResult = await db.getRegisteredCases({ limit: 1000 });
    const allRegistered = registryResult.cases || [];
    const totalCases = registryResult.total || 0;

    const activeCases = allRegistered.filter((c) => c.case_status === 'PENDING' || !c.case_status).length;
    const disposedCases = allRegistered.filter((c) => c.case_status === 'DISPOSED').length;

    // Cases today
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const newCasesToday = allRegistered.filter((c) => {
      const disc = c.first_discovered_at ? new Date(c.first_discovered_at).toISOString().slice(0, 10) : '';
      return disc === todayStr;
    }).length;

    const updatedCasesToday = allRegistered.filter((c) => {
      const up = c.updated_at ? new Date(c.updated_at).toISOString().slice(0, 10) : '';
      return up === todayStr;
    }).length;

    // 3. Queue health for failed jobs count
    const queueHealth = await getQueueHealth();
    const failedJobs = queueHealth.telemetry?.totalFailed || 0;

    // 4. Discovery jobs count
    const allJobs = await db.getDiscoveryJobs({ limit: 1000 });
    const activeDiscoveryJobs = (allJobs.jobs || []).filter((j) => j.status === 'RUNNING' || j.status === 'QUEUED').length;

    // 5. Backfill campaigns count
    const campaignsRes = await db.getBackfillCampaigns({ limit: 100 });
    const totalCampaigns = campaignsRes.total || 0;
    const activeCampaigns = (campaignsRes.campaigns || []).filter((c) => c.status === 'RUNNING').length;

    return {
      totalCourts,
      totalCases,
      activeCases,
      disposedCases,
      newCasesToday,
      updatedCasesToday,
      documents: 0, // Ingestion placeholder
      failedJobs,
      activeDiscoveryJobs,
      totalCampaigns,
      activeCampaigns,
    };
  }

  /**
   * System health and infrastructure telemetry
   */
  static async getSystemHealth() {
    const queueHealth = await getQueueHealth();
    return {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: isDbConnected ? 'CONNECTED' : 'STANDBY (In-Memory Fallback)',
          isPostgres: isDbConnected,
        },
        redis: {
          status: isRedisConnected ? 'CONNECTED' : 'STANDBY',
          isRedis: isRedisConnected,
        },
        queues: queueHealth,
      },
    };
  }

  /**
   * Recent activity feed (audit logs + discovery/sync activity)
   */
  static async getRecentActivity(limit = 15) {
    const logs = await db.getAuditLogs({ limit });
    return {
      activity: logs.logs || [],
      total: logs.total || 0,
    };
  }

  /**
   * Queue metrics breakdown
   */
  static async getQueueStatus() {
    return getQueueHealth();
  }
}
