import { Worker } from 'bullmq';
import { redisConnectionOptions, isRedisConnected } from '../config/redis.js';
import { QUEUE_NAMES, queues } from '../queues/queueManager.js';
import { CaseSearchService } from '../services/ecourtsIndia/caseSearchService.js';
import { executeCaseDetailSync } from './caseDetailWorker.js';
import { db } from '../database/datastore.js';
import { logger } from '../utils/logger.js';

export const jobControlFlags = new Map(); // jobId -> 'PAUSE' | 'CANCEL' | null

/**
 * Main Discovery Job Execution Loop
 */
export const executeDiscoveryJob = async (jobId) => {
  logger.info(`[DiscoveryWorker] Starting execution of discovery job [${jobId}]`);
  const job = await db.findDiscoveryJobById(jobId);
  if (!job) {
    logger.warn(`[DiscoveryWorker] Discovery job ${jobId} not found in database. Skipping.`);
    return { status: 'NOT_FOUND' };
  }

  // Check if job was cancelled or completed
  if (jobControlFlags.get(jobId) === 'CANCEL' || job.status === 'CANCELLED') {
    logger.info(`[DiscoveryWorker] Discovery job [${jobId}] is in CANCELLED state. Skipping execution.`);
    return { status: 'CANCELLED' };
  }
  if (job.status === 'COMPLETED') {
    return job;
  }
  if (jobControlFlags.get(jobId) === 'PAUSE' || (job.status === 'PAUSED' && !jobControlFlags.has(jobId))) {
    logger.info(`[DiscoveryWorker] Discovery job [${jobId}] is in PAUSED state. Skipping execution.`);
    return { status: 'PAUSED' };
  }

  // Ensure court exists
  const court = await db.findCourtById(job.court_id);
  const courtCode = court?.code || 'BOM_HC_BOMBAY';

  const filters = job.filters || {};
  const strategy = job.strategy || 'SINGLE';

  let totalPages = job.total_pages || (strategy === 'HISTORICAL_BACKFILL' ? 3 : strategy === 'INCREMENTAL' ? 2 : 3);
  let currentPage = job.current_page || 1;
  let recordsFound = job.records_found || 0;
  let newCasesFound = job.new_cases_found || 0;
  let existingCasesFound = job.existing_cases_found || 0;
  let processedRecords = job.processed_records || 0;

  // Mark job RUNNING unless paused or cancelled in the meantime
  const freshJob = await db.findDiscoveryJobById(jobId);
  if (freshJob?.status === 'CANCELLED' || jobControlFlags.get(jobId) === 'CANCEL') {
    return { status: 'CANCELLED' };
  }
  if (freshJob?.status === 'PAUSED' || jobControlFlags.get(jobId) === 'PAUSE') {
    return { status: 'PAUSED' };
  }

  await db.updateDiscoveryJob(jobId, {
    status: 'RUNNING',
    total_pages: totalPages,
    started_at: freshJob?.started_at || new Date().toISOString(),
  });

  try {
    while (currentPage <= totalPages) {
      // 1. Check for Pause or Cancel flags before page request
      const flag = jobControlFlags.get(jobId);
      if (flag === 'PAUSE') {
        logger.info(`[DiscoveryWorker] Discovery job [${jobId}] paused at page ${currentPage}`);
        await db.updateDiscoveryJob(jobId, {
          status: 'PAUSED',
          current_page: currentPage,
          records_found: recordsFound,
          new_cases_found: newCasesFound,
          existing_cases_found: existingCasesFound,
          processed_records: processedRecords,
        });
        if (job.campaign_id) await db.updateCampaignProgress(job.campaign_id);
        if (job.daily_run_id) await db.updateDailyRunProgress(job.daily_run_id);
        jobControlFlags.delete(jobId);
        return { status: 'PAUSED', currentPage };
      }

      if (flag === 'CANCEL') {
        logger.info(`[DiscoveryWorker] Discovery job [${jobId}] cancelled at page ${currentPage}`);
        await db.updateDiscoveryJob(jobId, {
          status: 'CANCELLED',
          completed_at: new Date().toISOString(),
          current_page: currentPage,
          records_found: recordsFound,
          new_cases_found: newCasesFound,
          existing_cases_found: existingCasesFound,
          processed_records: processedRecords,
        });
        if (job.campaign_id) await db.updateCampaignProgress(job.campaign_id);
        if (job.daily_run_id) await db.updateDailyRunProgress(job.daily_run_id);
        jobControlFlags.delete(jobId);
        return { status: 'CANCELLED', currentPage };
      }

      logger.info(`[DiscoveryWorker] Job [${jobId}] fetching page ${currentPage}/${totalPages}...`);

      // 2. Execute API Search Request
      const response = await CaseSearchService.discoverCases({
        courtCode,
        filingYear: filters.filingYear || new Date().getFullYear(),
        caseType: filters.caseType || 'WP',
        partyName: filters.partyName || '',
        advocateName: filters.advocateName || '',
        page: currentPage,
        limit: filters.limit || 10,
        customTotalPages: totalPages,
      });

      const cases = response?.data?.cases || [];
      recordsFound += cases.length;

      // 3. Process Cases & Register CNRs Idempotently
      for (const caseData of cases) {
        if (!caseData.cnr) continue;

        const regResult = await db.registerDiscoveredCnr({
          cnr: caseData.cnr,
          courtId: job.court_id,
          caseStatus: caseData.status || 'PENDING',
          syncStatus: 'PENDING_DETAIL',
          priorityScore: caseData.caseType === 'WP' || caseData.caseType === 'BAIL_APPL' ? 150 : 100,
          metadata: {
            caseNumber: caseData.caseNumber,
            filingYear: caseData.filingYear,
            caseType: caseData.caseType,
            title: caseData.title,
            filingDate: caseData.filingDate,
          },
        });

        if (regResult.isNew) {
          newCasesFound++;
          // If backfill or incremental daily discovery strategy, automatically enqueue detail sync
          if (strategy === 'HISTORICAL_BACKFILL' || strategy === 'INCREMENTAL') {
            if (isRedisConnected && queues[QUEUE_NAMES.CASE_DETAIL]) {
              queues[QUEUE_NAMES.CASE_DETAIL].add('syncCaseDetail', { cnr: caseData.cnr, userId: job.created_by }).catch(() => {});
            } else {
              executeCaseDetailSync(caseData.cnr, job.created_by).catch(() => {});
            }
          }
        } else {
          existingCasesFound++;
        }
        processedRecords++;
      }

      // 4. Update Progress in DB
      await db.updateDiscoveryJob(jobId, {
        current_page: currentPage,
        records_found: recordsFound,
        new_cases_found: newCasesFound,
        existing_cases_found: existingCasesFound,
        processed_records: processedRecords,
      });

      if (job.campaign_id) {
        await db.updateCampaignProgress(job.campaign_id);
      }
      if (job.daily_run_id) {
        await db.updateDailyRunProgress(job.daily_run_id);
      }

      // 5. Advance Page or Complete
      if (currentPage >= totalPages) {
        break;
      }

      currentPage++;
      // Polite delay respecting rate limits
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    // 6. Job Completed Successfully
    await db.updateDiscoveryJob(jobId, {
      status: 'COMPLETED',
      current_page: totalPages,
      records_found: recordsFound,
      new_cases_found: newCasesFound,
      existing_cases_found: existingCasesFound,
      processed_records: processedRecords,
      completed_at: new Date().toISOString(),
    });

    if (job.campaign_id) {
      await db.updateCampaignProgress(job.campaign_id);
    }
    if (job.daily_run_id) {
      await db.updateDailyRunProgress(job.daily_run_id);
    }

    await db.createAuditLog({
      userId: job.created_by,
      action: 'DISCOVERY_JOB_COMPLETED',
      entity: 'DISCOVERY_ENGINE',
      entityId: jobId,
      details: {
        courtId: job.court_id,
        courtCode,
        strategy,
        recordsFound,
        newCasesFound,
        existingCasesFound,
        totalPages,
      },
      ipAddress: '127.0.0.1',
      userAgent: 'DiscoveryWorker',
    });

    logger.info(`[DiscoveryWorker] Job [${jobId}] completed: ${recordsFound} records (${newCasesFound} new CNRs).`);
    return {
      status: 'COMPLETED',
      recordsFound,
      newCasesFound,
      existingCasesFound,
    };
  } catch (err) {
    logger.error(`[DiscoveryWorker] Job [${jobId}] encountered error`, err);
    await db.updateDiscoveryJob(jobId, {
      status: 'FAILED',
      error_message: err.message,
      completed_at: new Date().toISOString(),
      retry_count: (job.retry_count || 0) + 1,
    });
    if (job.campaign_id) {
      await db.updateCampaignProgress(job.campaign_id);
    }
    if (job.daily_run_id) {
      await db.updateDailyRunProgress(job.daily_run_id);
    }
    throw err;
  }
};

export let discoveryWorkerInstance = null;

export const initDiscoveryWorker = () => {
  if (!isRedisConnected) {
    logger.info('Redis is offline. In-process resilient discovery worker active.');
    return;
  }

  try {
    discoveryWorkerInstance = new Worker(
      QUEUE_NAMES.CASE_DISCOVERY,
      async (job) => {
        const jobId = job.data?.jobId || job.id;
        logger.info(`[DiscoveryWorker] BullMQ worker processing discovery job [${jobId}]`);
        return executeDiscoveryJob(jobId);
      },
      {
        connection: redisConnectionOptions,
        concurrency: 5,
      }
    );

    discoveryWorkerInstance.on('failed', (job, err) => {
      logger.error(`[DiscoveryWorker] BullMQ job [${job?.id}] failed: ${err.message}`);
    });

    logger.info(`BullMQ Worker registered for [${QUEUE_NAMES.CASE_DISCOVERY}]`);
  } catch (err) {
    logger.warn(`Could not start BullMQ discoveryWorker: ${err.message}`);
  }
};
