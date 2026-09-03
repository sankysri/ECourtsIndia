import { db } from '../../database/datastore.js';
import { queues, QUEUE_NAMES } from '../../queues/queueManager.js';
import { isRedisConnected } from '../../config/redis.js';
import { executeDiscoveryJob, jobControlFlags } from '../../workers/discoveryWorker.js';
import { DailyDiscoveryScheduler } from '../..//services/scheduler/dailyDiscoveryScheduler.js';
import { logAuditEvent } from '../../middleware/audit.js';
import { EnumService } from '../../services/ecourtsIndia/capabilitiesService.js';
import { logger } from '../../utils/logger.js';

export class DiscoveryService {
  /**
   * Create and enqueue a new discovery job
   */
  static async createJob({ courtId, strategy = 'SINGLE', filters = {}, createdBy = null, req }) {
    const court = await db.findCourtById(courtId);
    if (!court) {
      throw { statusCode: 404, message: 'Target court establishment not found', code: 'COURT_NOT_FOUND' };
    }

    // Determine pagination envelope based on strategy
    let totalPages = 3;
    if (strategy === 'HISTORICAL_BACKFILL') totalPages = 5;
    if (strategy === 'INCREMENTAL') totalPages = 2;
    if (filters.customTotalPages) totalPages = parseInt(filters.customTotalPages, 10);

    const job = await db.createDiscoveryJob({
      courtId,
      strategy,
      filters,
      createdBy,
      totalPages,
    });

    await logAuditEvent({
      userId: createdBy,
      action: 'DISCOVERY_JOB_CREATED',
      entity: 'DISCOVERY_ENGINE',
      entityId: job.id,
      details: {
        courtId,
        courtCode: court.code,
        strategy,
        filters,
        totalPages,
      },
      req,
    });

    // Enqueue in BullMQ or run in-process resilient task
    if (isRedisConnected && queues[QUEUE_NAMES.CASE_DISCOVERY]) {
      try {
        await queues[QUEUE_NAMES.CASE_DISCOVERY].add('discoverCases', { jobId: job.id, userId: createdBy });
      } catch (err) {
        logger.warn(`Could not add to Redis discovery queue: ${err.message}.`);
      }
    }
    executeDiscoveryJob(job.id).catch((e) => logger.error('Discovery execution error', e));

    return job;
  }

  static async getJobs(query) {
    const limit = parseInt(query.limit || '20', 10);
    const offset = parseInt(query.offset || '0', 10);
    return db.getDiscoveryJobs({
      courtId: query.courtId || null,
      dailyRunId: query.dailyRunId || null,
      status: query.status || null,
      strategy: query.strategy || null,
      limit,
      offset,
    });
  }

  static async getJobById(id) {
    const job = await db.findDiscoveryJobById(id);
    if (!job) {
      throw { statusCode: 404, message: 'Discovery job not found', code: 'JOB_NOT_FOUND' };
    }
    return job;
  }

  static async pauseJob(id, userId, req) {
    const job = await db.findDiscoveryJobById(id);
    if (!job) {
      throw { statusCode: 404, message: 'Discovery job not found', code: 'JOB_NOT_FOUND' };
    }

    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      throw { statusCode: 400, message: `Cannot pause job in ${job.status} state`, code: 'INVALID_JOB_STATE' };
    }

    jobControlFlags.set(id, 'PAUSE');
    const updated = await db.updateDiscoveryJob(id, { status: 'PAUSED' });

    await logAuditEvent({
      userId,
      action: 'DISCOVERY_JOB_PAUSED',
      entity: 'DISCOVERY_ENGINE',
      entityId: id,
      details: { previousStatus: job.status, currentPage: job.current_page },
      req,
    });

    return updated;
  }

  static async resumeJob(id, userId, req) {
    const job = await db.findDiscoveryJobById(id);
    if (!job) {
      throw { statusCode: 404, message: 'Discovery job not found', code: 'JOB_NOT_FOUND' };
    }

    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      throw { statusCode: 400, message: `Cannot resume job from ${job.status} state`, code: 'INVALID_JOB_STATE' };
    }

    jobControlFlags.delete(id);
    const updated = await db.updateDiscoveryJob(id, { status: 'RUNNING', error_message: null });

    await logAuditEvent({
      userId,
      action: 'DISCOVERY_JOB_RESUMED',
      entity: 'DISCOVERY_ENGINE',
      entityId: id,
      details: { resumedFromPage: job.current_page },
      req,
    });

    // Re-trigger execution
    executeDiscoveryJob(id).catch(() => {});

    return updated;
  }

  static async retryJob(id, userId, req) {
    const job = await db.findDiscoveryJobById(id);
    if (!job) {
      throw { statusCode: 404, message: 'Discovery job not found', code: 'JOB_NOT_FOUND' };
    }

    jobControlFlags.delete(id);
    const updated = await db.updateDiscoveryJob(id, {
      status: 'RUNNING',
      error_message: null,
      retry_count: (job.retry_count || 0) + 1,
    });

    await logAuditEvent({
      userId,
      action: 'DISCOVERY_JOB_RETRIED',
      entity: 'DISCOVERY_ENGINE',
      entityId: id,
      details: { retryCount: updated.retry_count },
      req,
    });

    executeDiscoveryJob(id).catch(() => {});

    return updated;
  }

  static async cancelJob(id, userId, req) {
    const job = await db.findDiscoveryJobById(id);
    if (!job) {
      throw { statusCode: 404, message: 'Discovery job not found', code: 'JOB_NOT_FOUND' };
    }

    jobControlFlags.set(id, 'CANCEL');
    const updated = await db.updateDiscoveryJob(id, {
      status: 'CANCELLED',
      completed_at: new Date().toISOString(),
    });

    await logAuditEvent({
      userId,
      action: 'DISCOVERY_JOB_CANCELLED',
      entity: 'DISCOVERY_ENGINE',
      entityId: id,
      details: { cancelledAtPage: job.current_page },
      req,
    });

    return updated;
  }

  static async getRegistry(query) {
    const limit = parseInt(query.limit || '20', 10);
    const offset = parseInt(query.offset || '0', 10);
    return db.getRegisteredCases({
      search: query.search || '',
      courtId: query.courtId || '',
      stateCode: query.state || '',
      syncStatus: query.syncStatus || '',
      caseStatus: query.caseStatus || '',
      sortBy: query.sortBy || 'last_discovered_at',
      sortOrder: query.sortOrder || 'DESC',
      limit,
      offset,
    });
  }

  static async getRegistryStats() {
    return db.getRegistryStats();
  }

  static async getFiltersMetadata() {
    const enums = await EnumService.getGroupedEnums();
    const states = await db.getStates();
    return {
      states,
      caseTypes: enums.case_types || [],
      caseStatuses: enums.case_statuses || [],
      searchFilters: enums.search_filters || [],
      strategies: [
        {
          code: 'SINGLE',
          label: 'Single Search Query',
          description: 'Discovers case filings for targeted parameter criteria within 1-3 result pages.',
          estimatedVolume: '10 - 30 CNRs',
        },
        {
          code: 'HISTORICAL_BACKFILL',
          label: 'Historical Year Backfill',
          description: 'Iterative multi-page discovery traversing historical annual filings across all case categories.',
          estimatedVolume: '50 - 200 CNRs per batch',
        },
        {
          code: 'INCREMENTAL',
          label: 'Incremental Recent Filings',
          description: 'Rapid crawler targeting current active year and newly logged judicial dockets.',
          estimatedVolume: '10 - 20 CNRs',
        },
      ],
    };
  }

  // ==========================================
  // Milestone 6: Daily Discovery Methods
  // ==========================================

  static async getDailyStatus() {
    return DailyDiscoveryScheduler.getSchedulerConfig();
  }

  static async updateDailyConfig(updates, userId, req) {
    const updated = await DailyDiscoveryScheduler.updateSchedulerConfig(updates);
    await logAuditEvent({
      userId,
      action: 'DAILY_DISCOVERY_CONFIG_UPDATED',
      entity: 'DAILY_SCHEDULER',
      entityId: 'SETTINGS',
      details: updates,
      req,
    });
    return updated;
  }

  static async triggerDailyDiscovery({ lookbackWindow, courtIds, userId, req }) {
    const result = await DailyDiscoveryScheduler.triggerDailyDiscovery({
      lookbackWindowOverride: lookbackWindow,
      courtIdsOverride: courtIds,
      triggeredBy: userId,
    });
    return result;
  }

  static async getDailyHistory(query) {
    const limit = parseInt(query.limit || '20', 10);
    const offset = parseInt(query.offset || '0', 10);
    return db.getDailyDiscoveryRuns({ limit, offset });
  }
}
