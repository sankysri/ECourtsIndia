import { db } from '../../database/datastore.js';
import { QUEUE_NAMES, queues } from '../../queues/queueManager.js';
import { isRedisConnected } from '../../config/redis.js';
import { executeDiscoveryJob } from '../../workers/discoveryWorker.js';
import { logger } from '../../utils/logger.js';

/**
 * Daily Discovery Scheduler Service (M6)
 * Orchestrates automated incremental discovery runs across active court complexes.
 */
export class DailyDiscoveryScheduler {
  /**
   * Compute date range for overlapping lookback windows
   */
  static calculateLookbackDates(lookbackWindow = 'LAST_7_DAYS') {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    let startDateObj = new Date(now);

    switch (lookbackWindow) {
      case 'TODAY':
        startDateObj = now;
        break;
      case 'YESTERDAY':
        startDateObj.setDate(startDateObj.getDate() - 1);
        break;
      case 'LAST_30_DAYS':
        startDateObj.setDate(startDateObj.getDate() - 30);
        break;
      case 'LAST_7_DAYS':
      default:
        startDateObj.setDate(startDateObj.getDate() - 7);
        break;
    }

    const startDate = startDateObj.toISOString().split('T')[0];
    const filingYear = now.getFullYear();

    return { startDate, endDate, filingYear, lookbackWindow };
  }

  /**
   * Fetch current scheduler status, settings, last run summary, and next scheduled execution
   */
  static async getSchedulerConfig() {
    const enabledSetting = await db.getSettingByKey('daily_discovery_enabled');
    const lookbackSetting = await db.getSettingByKey('daily_discovery_lookback_window');
    const cronSetting = await db.getSettingByKey('daily_discovery_cron');
    const activeOnlySetting = await db.getSettingByKey('daily_discovery_active_courts_only');
    const maxJobsSetting = await db.getSettingByKey('daily_discovery_max_jobs_per_run');

    const lastRun = await db.getLastDailyDiscoveryRun();

    // Calculate next run approx (24 hours after last run or tomorrow at 2:00 AM)
    const nextRun = new Date();
    nextRun.setDate(nextRun.getDate() + 1);
    nextRun.setHours(2, 0, 0, 0);

    return {
      enabled: enabledSetting ? Boolean(enabledSetting.value) : true,
      lookbackWindow: lookbackSetting?.value || 'LAST_7_DAYS',
      cron: cronSetting?.value || '0 2 * * *',
      activeCourtsOnly: activeOnlySetting ? Boolean(activeOnlySetting.value) : true,
      maxJobsPerRun: Number(maxJobsSetting?.value || 20),
      lastRun: lastRun || null,
      nextRunAt: nextRun.toISOString(),
      supportedWindows: [
        { code: 'TODAY', label: 'Today (Same-day filings)', lookbackDays: 0 },
        { code: 'YESTERDAY', label: 'Yesterday (24-hour lookback)', lookbackDays: 1 },
        { code: 'LAST_7_DAYS', label: 'Last 7 Days (Recommended overlap)', lookbackDays: 7 },
        { code: 'LAST_30_DAYS', label: 'Last 30 Days (Extended sweep)', lookbackDays: 30 },
      ],
    };
  }

  /**
   * Update scheduler settings
   */
  static async updateSchedulerConfig(updates) {
    if (updates.enabled !== undefined) {
      await db.setSetting('daily_discovery_enabled', Boolean(updates.enabled), 'Enable automated daily case discovery', true);
    }
    if (updates.lookbackWindow) {
      await db.setSetting('daily_discovery_lookback_window', updates.lookbackWindow, 'Default lookback window', true);
    }
    if (updates.cron) {
      await db.setSetting('daily_discovery_cron', updates.cron, 'Cron schedule expression', true);
    }
    if (updates.activeCourtsOnly !== undefined) {
      await db.setSetting('daily_discovery_active_courts_only', Boolean(updates.activeCourtsOnly), 'Scan active courts only', true);
    }
    if (updates.maxJobsPerRun !== undefined) {
      await db.setSetting('daily_discovery_max_jobs_per_run', Number(updates.maxJobsPerRun), 'Maximum jobs per daily run', true);
    }

    return this.getSchedulerConfig();
  }

  /**
   * Execute or trigger an incremental daily discovery run
   */
  static async triggerDailyDiscovery({ lookbackWindowOverride = null, courtIdsOverride = null, triggeredBy = null, totalPagesPerCourt = 2 } = {}) {
    logger.info('[DailyDiscoveryScheduler] Triggering incremental daily discovery run...');

    const config = await this.getSchedulerConfig();
    const lookbackWindow = lookbackWindowOverride || config.lookbackWindow;
    const { startDate, endDate, filingYear } = this.calculateLookbackDates(lookbackWindow);

    // 1. Fetch active court establishments
    let courtsToScan = [];
    if (courtIdsOverride && courtIdsOverride.length > 0) {
      for (const id of courtIdsOverride) {
        const c = await db.findCourtById(id);
        if (c) courtsToScan.push(c);
      }
    } else {
      const courtsQuery = await db.getCourts({
        status: config.activeCourtsOnly ? 'ACTIVE' : '',
        limit: config.maxJobsPerRun || 20,
      });
      courtsToScan = courtsQuery.courts;
    }

    if (courtsToScan.length === 0) {
      throw new Error('No active courts available to scan for daily discovery.');
    }

    // 2. Create daily_discovery_runs execution record
    const dailyRun = await db.createDailyDiscoveryRun({
      lookbackWindow,
      courtsScanned: courtsToScan.length,
      jobsCreated: courtsToScan.length,
      metadata: {
        startDate,
        endDate,
        filingYear,
        triggeredBy,
        manualTrigger: Boolean(triggeredBy),
      },
    });

    const createdJobs = [];

    // 3. Generate segmented INCREMENTAL discovery jobs for each court
    for (const court of courtsToScan) {
      const job = await db.createDiscoveryJob({
        dailyRunId: dailyRun.id,
        courtId: court.id,
        strategy: 'INCREMENTAL',
        filters: {
          filingYear,
          startDate,
          endDate,
          lookbackWindow,
          caseType: 'WP', // primary discovery stream
          customTotalPages: totalPagesPerCourt,
        },
        createdBy: triggeredBy,
        totalPages: totalPagesPerCourt,
      });

      createdJobs.push(job);

      // Dispatch to BullMQ or in-process queue
      if (isRedisConnected && queues[QUEUE_NAMES.CASE_DISCOVERY]) {
        try {
          await queues[QUEUE_NAMES.CASE_DISCOVERY].add(
            'executeDailyDiscoverySegment',
            { jobId: job.id, dailyRunId: dailyRun.id },
            {
              attempts: 3,
              backoff: { type: 'exponential', delay: 2000 },
            }
          );
        } catch {}
      }

      setImmediate(() => {
        executeDiscoveryJob(job.id).catch((err) => {
          logger.error(`[DailyDiscovery] In-process execution failed for job ${job.id}: ${err.message}`);
        });
      });
    }

    await db.createAuditLog({
      userId: triggeredBy,
      action: 'DAILY_DISCOVERY_TRIGGERED',
      entity: 'DAILY_SCHEDULER',
      entityId: dailyRun.id,
      details: {
        lookbackWindow,
        startDate,
        endDate,
        courtsCount: courtsToScan.length,
        jobsCreated: createdJobs.length,
      },
      ipAddress: '127.0.0.1',
      userAgent: 'DailyDiscoveryScheduler',
    });

    logger.info(`[DailyDiscoveryScheduler] Dispatched daily discovery run [${dailyRun.id}] with ${createdJobs.length} court segments.`);

    return {
      dailyRun,
      jobsCount: createdJobs.length,
      lookbackWindow,
      startDate,
      endDate,
      courts: courtsToScan.map((c) => ({ id: c.id, code: c.code, name: c.name })),
    };
  }
}
