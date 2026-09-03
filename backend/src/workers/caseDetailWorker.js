import { Worker } from 'bullmq';
import { redisConnectionOptions, isRedisConnected } from '../config/redis.js';
import { QUEUE_NAMES, queues } from '../queues/queueManager.js';
import { CaseDetailService } from '../services/ecourtsIndia/caseDetailService.js';
import { CaseNormalizer } from '../services/normalizers/caseNormalizer.js';
import { PartyNormalizer } from '../services/normalizers/partyNormalizer.js';
import { AdvocateNormalizer } from '../services/normalizers/advocateNormalizer.js';
import { JudgeNormalizer } from '../services/normalizers/judgeNormalizer.js';
import { HearingNormalizer } from '../services/normalizers/hearingNormalizer.js';
import { OrderNormalizer } from '../services/normalizers/orderNormalizer.js';
import { db } from '../database/datastore.js';
import { logger } from '../utils/logger.js';

/**
 * Ingests full case detail for a single CNR
 */
export const executeCaseDetailSync = async (cnr, userId = null) => {
  const normalizedCnr = String(cnr).toUpperCase().trim();
  logger.info(`[CaseDetailWorker] Starting detail ingestion for CNR [${normalizedCnr}]`);

  // 1. Check if CNR exists in registry to obtain courtId
  let regRecord = (await db.getRegisteredCases({ search: normalizedCnr, limit: 1 })).cases[0];
  let courtId = regRecord?.court_id;

  if (!courtId) {
    // If not in registry, pick the principal Bombay High Court as fallback
    const hc = await db.findCourtByCode('BOM_HC_BOMBAY');
    courtId = hc?.id;
  }

  try {
    // 2. Call upstream eCourts API
    const response = await CaseDetailService.getCaseDetail(normalizedCnr);
    const rawData = response?.data;

    if (!rawData) {
      throw new Error(`Upstream API returned empty response for CNR ${normalizedCnr}`);
    }

    // 3. Archive Raw API Response in database
    const rawRecord = await db.archiveRawApiResponse({
      source: 'ECOURTS_INDIA',
      endpoint: `/cases/detail/${normalizedCnr}`,
      caseCnr: normalizedCnr,
      rawPayload: rawData,
      storagePath: `s3://nyayadata-ecourts-archive/cases/${normalizedCnr}.json`,
    });

    // 4. Run Normalizers
    const caseData = CaseNormalizer.normalize(rawData, courtId);
    const parties = PartyNormalizer.normalize(rawData.parties);
    const advocates = AdvocateNormalizer.normalize(rawData.advocates);
    const judges = JudgeNormalizer.normalize(rawData.judges, courtId);
    const hearings = HearingNormalizer.normalize(rawData.hearings);
    const orders = OrderNormalizer.normalizeOrders(rawData.orders);
    const judgments = OrderNormalizer.normalizeJudgments(rawData.judgments);

    // 5. Persist Relational Graph Transaction
    const saveRes = await db.saveCaseDetailTransaction({
      caseData,
      parties,
      advocates,
      judges,
      hearings,
      orders,
      judgments,
      rawResponseId: rawRecord.id,
    });

    // 6. Dispatch Search Indexing Event to indexQueue
    if (isRedisConnected && queues[QUEUE_NAMES.INDEX]) {
      try {
        await queues[QUEUE_NAMES.INDEX].add('indexCaseDocument', {
          caseId: saveRes.caseId,
          cnr: normalizedCnr,
          title: caseData.title,
          caseNumber: caseData.caseNumber,
          courtId,
          indexedAt: new Date().toISOString(),
        });
        logger.info(`[CaseDetailWorker] Dispatched index job for CNR [${normalizedCnr}]`);
      } catch (err) {
        logger.warn(`Could not dispatch indexQueue job: ${err.message}`);
      }
    }

    // 7. Audit Log
    await db.createAuditLog({
      userId,
      action: 'CASE_DETAIL_SYNCED',
      entity: 'CASE_DOSSIER',
      entityId: normalizedCnr,
      details: {
        cnr: normalizedCnr,
        caseId: saveRes.caseId,
        partiesCount: parties.length,
        advocatesCount: advocates.length,
        hearingsCount: hearings.length,
        ordersCount: orders.length,
      },
      ipAddress: '127.0.0.1',
      userAgent: 'CaseDetailWorker',
    });

    logger.info(`[CaseDetailWorker] Ingested case [${normalizedCnr}]: ${parties.length} parties, ${hearings.length} hearings, ${orders.length} orders.`);
    return { success: true, cnr: normalizedCnr, caseId: saveRes.caseId };
  } catch (err) {
    logger.error(`[CaseDetailWorker] Ingestion failed for CNR [${normalizedCnr}]`, err);

    // Mark failed in case_registry without crashing worker
    await db.updateCaseRegistrySyncStatus(normalizedCnr, 'FAILED');

    await db.createAuditLog({
      userId,
      action: 'CASE_DETAIL_SYNC_FAILED',
      entity: 'CASE_DOSSIER',
      entityId: normalizedCnr,
      details: { error: err.message },
      ipAddress: '127.0.0.1',
      userAgent: 'CaseDetailWorker',
    });

    throw err;
  }
};

export let caseDetailWorkerInstance = null;

export const initCaseDetailWorker = () => {
  if (!isRedisConnected) {
    logger.info('Redis is offline. In-process resilient case detail runner active.');
    return;
  }

  try {
    caseDetailWorkerInstance = new Worker(
      QUEUE_NAMES.CASE_DETAIL,
      async (job) => {
        const cnr = job.data?.cnr || job.data?.caseCnr;
        logger.info(`[CaseDetailWorker] BullMQ processing job [${job.id}] for CNR [${cnr}]`);
        return executeCaseDetailSync(cnr, job.data?.userId);
      },
      {
        connection: redisConnectionOptions,
        concurrency: 5,
      }
    );

    caseDetailWorkerInstance.on('failed', (job, err) => {
      logger.error(`[CaseDetailWorker] BullMQ job [${job?.id}] failed: ${err.message}`);
    });

    logger.info(`BullMQ Worker registered for [${QUEUE_NAMES.CASE_DETAIL}]`);
  } catch (err) {
    logger.warn(`Could not start BullMQ caseDetailWorker: ${err.message}`);
  }
};
