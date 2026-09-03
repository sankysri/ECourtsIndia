import { Worker } from 'bullmq';
import { redisConnectionOptions, isRedisConnected } from '../config/redis.js';
import { QUEUE_NAMES, queues } from '../queues/queueManager.js';
import { CourtService } from '../services/ecourtsIndia/courtService.js';
import { EnumService } from '../services/ecourtsIndia/capabilitiesService.js';
import { db } from '../database/datastore.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export const activeSyncJobs = new Map(); // jobId -> { status, progress, message, result, error, startedAt, completedAt }

/**
 * Executes full court master & dynamic enum synchronization
 */
export const executeCourtSync = async (jobId, userId = null) => {
  const jobState = {
    jobId,
    status: 'IN_PROGRESS',
    progress: 10,
    message: 'Initializing eCourts API court master synchronization...',
    startedAt: new Date().toISOString(),
    result: null,
    error: null,
  };
  activeSyncJobs.set(jobId, jobState);

  try {
    // 1. Sync Dynamic Enums
    jobState.progress = 30;
    jobState.message = 'Synchronizing dynamic API capabilities and reference enums...';
    activeSyncJobs.set(jobId, { ...jobState });
    const enumRes = await EnumService.syncEnums();

    // 2. Fetch & Upsert Court Hierarchy
    jobState.progress = 60;
    jobState.message = 'Fetching upstream judicial hierarchy (States, Districts, Courts)...';
    activeSyncJobs.set(jobId, { ...jobState });
    const courtRes = await CourtService.syncCourtHierarchy();

    // 3. Finalize & Audit Log
    jobState.progress = 100;
    jobState.status = 'COMPLETED';
    jobState.message = `Sync completed: ${courtRes.courtsSynced} courts, ${courtRes.districtsSynced} districts, ${courtRes.statesSynced} states, ${enumRes.enumsSynced} enums.`;
    jobState.result = { ...courtRes, ...enumRes };
    jobState.completedAt = new Date().toISOString();
    activeSyncJobs.set(jobId, { ...jobState });

    await db.createAuditLog({
      userId,
      action: 'COURT_SYNC_COMPLETED',
      entity: 'COURT_MASTER',
      entityId: jobId,
      details: jobState.result,
      ipAddress: '127.0.0.1',
      userAgent: 'CourtSyncWorker',
    });

    logger.info(`[CourtSyncWorker] Job [${jobId}] successfully completed.`);
    return jobState;
  } catch (err) {
    jobState.status = 'FAILED';
    jobState.progress = 100;
    jobState.message = `Court synchronization failed: ${err.message}`;
    jobState.error = err.message;
    jobState.completedAt = new Date().toISOString();
    activeSyncJobs.set(jobId, { ...jobState });

    logger.error(`[CourtSyncWorker] Job [${jobId}] failed`, err);
    throw err;
  }
};

export let courtSyncWorkerInstance = null;

export const initCourtSyncWorker = () => {
  if (!isRedisConnected) {
    logger.info('Redis is offline. In-process resilient court sync runner active.');
    return;
  }

  try {
    courtSyncWorkerInstance = new Worker(
      QUEUE_NAMES.COURT_SYNC,
      async (job) => {
        const jobId = job.data?.jobId || job.id;
        logger.info(`[CourtSyncWorker] Processing BullMQ job [${jobId}]`);
        return executeCourtSync(jobId, job.data?.userId);
      },
      {
        connection: redisConnectionOptions,
        concurrency: 2,
      }
    );

    courtSyncWorkerInstance.on('failed', (job, err) => {
      logger.error(`[CourtSyncWorker] BullMQ job [${job?.id}] failed: ${err.message}`);
    });

    logger.info(`BullMQ Worker registered for [${QUEUE_NAMES.COURT_SYNC}]`);
  } catch (err) {
    logger.warn(`Could not start BullMQ courtSyncWorker: ${err.message}`);
  }
};
