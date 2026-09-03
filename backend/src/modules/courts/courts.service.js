import { db } from '../../database/datastore.js';
import { queues, QUEUE_NAMES } from '../../queues/queueManager.js';
import { isRedisConnected } from '../../config/redis.js';
import { executeCourtSync, activeSyncJobs } from '../../workers/courtSyncWorker.js';
import { logAuditEvent } from '../../middleware/audit.js';
import { EnumService } from '../../services/ecourtsIndia/capabilitiesService.js';
import { logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class CourtsService {
  static async getCourts(query) {
    const limit = parseInt(query.limit || '20', 10);
    const offset = parseInt(query.offset || '0', 10);
    return db.getCourts({
      search: query.search || '',
      stateCode: query.state || '',
      districtCode: query.district || '',
      type: query.type || '',
      status: query.status || '',
      sortBy: query.sortBy || 'name',
      sortOrder: query.sortOrder || 'ASC',
      limit,
      offset,
    });
  }

  static async getCourtById(id) {
    const court = await db.findCourtById(id);
    if (!court) {
      throw { statusCode: 404, message: 'Court establishment not found', code: 'COURT_NOT_FOUND' };
    }
    return court;
  }

  static async getCourtHierarchy() {
    return db.getCourtHierarchy();
  }

  static async getMetadata() {
    const enums = await EnumService.getGroupedEnums();
    const states = await db.getStates();
    return {
      states,
      enums,
    };
  }

  static async getCourtLogs(courtCode, limit = 20) {
    return db.getApiRequestLogs({ courtCode, limit });
  }

  static async triggerCourtSync({ userId, req }) {
    const jobId = `sync_court_${Date.now()}_${uuidv4().substring(0, 6)}`;

    await logAuditEvent({
      userId,
      action: 'COURT_SYNC_TRIGGERED',
      entity: 'COURT_MASTER',
      entityId: jobId,
      details: { jobId, trigger: 'MANUAL_ADMIN_ACTION' },
      req,
    });

    // Initialize progress tracking
    activeSyncJobs.set(jobId, {
      jobId,
      status: 'IN_PROGRESS',
      progress: 10,
      message: 'Dispatching court sync job...',
      startedAt: new Date().toISOString(),
    });

    if (isRedisConnected && queues[QUEUE_NAMES.COURT_SYNC]) {
      try {
        await queues[QUEUE_NAMES.COURT_SYNC].add('syncCourts', { userId, jobId });
      } catch (err) {
        logger.warn(`Could not dispatch to Redis queue: ${err.message}.`);
      }
    }

    // Trigger async execution
    executeCourtSync(jobId, userId).catch((e) => logger.error('Sync execution failed', e));

    return { jobId, status: 'IN_PROGRESS' };
  }

  static async getSyncJobStatus(jobId) {
    const jobState = activeSyncJobs.get(jobId);
    if (!jobState) {
      return {
        jobId,
        status: 'COMPLETED',
        progress: 100,
        message: 'Sync job completed or processed previously.',
      };
    }
    return jobState;
  }
}
