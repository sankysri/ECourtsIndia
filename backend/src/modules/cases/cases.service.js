import { db } from '../../database/datastore.js';
import { queues, QUEUE_NAMES } from '../../queues/queueManager.js';
import { isRedisConnected } from '../../config/redis.js';
import { executeCaseDetailSync } from '../../workers/caseDetailWorker.js';
import { logAuditEvent } from '../../middleware/audit.js';
import { logger } from '../../utils/logger.js';

export class CasesService {
  static async getCases(query) {
    const limit = parseInt(query.limit || '20', 10);
    const offset = parseInt(query.offset || '0', 10);
    return db.getCases({
      search: query.search || '',
      courtId: query.courtId || '',
      caseType: query.caseType || '',
      status: query.status || '',
      filingYear: query.filingYear || '',
      sortBy: query.sortBy || 'filing_date',
      sortOrder: query.sortOrder || 'DESC',
      limit,
      offset,
    });
  }

  static async getCaseByCnr(cnr) {
    const caseData = await db.getCaseByCnr(cnr);
    if (!caseData) {
      throw { statusCode: 404, message: `Case with CNR ${cnr} not found`, code: 'CASE_NOT_FOUND' };
    }

    // Fetch audit change history for this case
    const auditLogs = await db.getAuditLogs(20, 0, 'CASE_DOSSIER', cnr);

    return {
      case: caseData,
      auditLogs,
    };
  }

  static async getRawCaseSource(cnr) {
    const raw = await db.getRawApiResponseByCnr(cnr);
    if (!raw) {
      throw { statusCode: 404, message: `Raw API response for CNR ${cnr} not found`, code: 'RAW_SOURCE_NOT_FOUND' };
    }
    return raw;
  }

  static async triggerCaseDetailSync(cnr, userId, req) {
    const normalizedCnr = String(cnr).toUpperCase().trim();

    await logAuditEvent({
      userId,
      action: 'CASE_DETAIL_SYNC_TRIGGERED',
      entity: 'CASE_DOSSIER',
      entityId: normalizedCnr,
      details: { cnr: normalizedCnr, trigger: 'MANUAL_TRIGGER' },
      req,
    });

    if (isRedisConnected && queues[QUEUE_NAMES.CASE_DETAIL]) {
      try {
        await queues[QUEUE_NAMES.CASE_DETAIL].add('syncCaseDetail', { cnr: normalizedCnr, userId });
      } catch (err) {
        logger.warn(`Could not dispatch to Redis queue: ${err.message}.`);
      }
    }

    // Direct background execution
    executeCaseDetailSync(normalizedCnr, userId).catch((e) => logger.error('Case detail sync failed', e));

    return { cnr: normalizedCnr, status: 'QUEUED' };
  }

  static async batchSyncPendingCases(limit = 10, userId, req) {
    const pendingCases = (await db.getRegisteredCases({ syncStatus: 'PENDING_DETAIL', limit })).cases;

    const dispatched = [];
    for (const c of pendingCases) {
      if (isRedisConnected && queues[QUEUE_NAMES.CASE_DETAIL]) {
        try {
          await queues[QUEUE_NAMES.CASE_DETAIL].add('syncCaseDetail', { cnr: c.cnr, userId });
        } catch {}
      }
      executeCaseDetailSync(c.cnr, userId).catch(() => {});
      dispatched.push(c.cnr);
    }

    await logAuditEvent({
      userId,
      action: 'CASE_BATCH_SYNC_TRIGGERED',
      entity: 'CASE_DOSSIER',
      entityId: `batch_${Date.now()}`,
      details: { count: dispatched.length, cnrs: dispatched },
      req,
    });

    return { count: dispatched.length, cnrs: dispatched };
  }
}
