import { db } from '../../database/datastore.js';
import { queues, QUEUE_NAMES } from '../../queues/queueManager.js';
import { isRedisConnected } from '../../config/redis.js';
import { executeDiscoveryJob, jobControlFlags } from '../../workers/discoveryWorker.js';
import { logAuditEvent } from '../../middleware/audit.js';
import { logger } from '../../utils/logger.js';

export class BackfillService {
  /**
   * Creates a historical backfill campaign and splits it into segmented discovery jobs
   */
  static async createCampaign({ name, courtIds = [], startYear, endYear, caseTypes = ['WP', 'CS'], statuses = ['PENDING', 'DISPOSED'], totalPagesPerSegment = 2, userId = null, req = null }) {
    if (!name) {
      throw { statusCode: 400, message: 'Campaign name is required', code: 'VALIDATION_ERROR' };
    }
    if (!Array.isArray(courtIds) || courtIds.length === 0) {
      throw { statusCode: 400, message: 'At least one court must be selected for backfill', code: 'VALIDATION_ERROR' };
    }

    const sYear = parseInt(startYear, 10) || new Date().getFullYear();
    const eYear = parseInt(endYear, 10) || sYear;

    if (eYear < sYear) {
      throw { statusCode: 400, message: 'End year must be greater than or equal to start year', code: 'VALIDATION_ERROR' };
    }

    const types = Array.isArray(caseTypes) && caseTypes.length > 0 ? caseTypes : ['WP', 'CS'];
    const years = [];
    for (let y = sYear; y <= eYear; y++) {
      years.push(y);
    }

    // 1. Generate Cartesian product segments
    const segments = [];
    for (const courtId of courtIds) {
      for (const year of years) {
        for (const caseType of types) {
          segments.push({
            courtId,
            filingYear: year,
            caseType,
          });
        }
      }
    }

    const totalJobs = segments.length;

    // 2. Create Parent Campaign
    const campaign = await db.createBackfillCampaign({
      name,
      selectedCourts: courtIds,
      startDate: `${sYear}-01-01`,
      endDate: `${eYear}-12-31`,
      caseTypes: types,
      statuses,
      totalJobs,
      createdBy: userId,
      metadata: {
        startYear: sYear,
        endYear: eYear,
        segmentCount: totalJobs,
        totalPagesPerSegment,
      },
    });

    // 3. Create and Enqueue Segmented Discovery Jobs
    const createdJobIds = [];
    for (const seg of segments) {
      const job = await db.createDiscoveryJob({
        campaignId: campaign.id,
        courtId: seg.courtId,
        strategy: 'HISTORICAL_BACKFILL',
        filters: {
          filingYear: seg.filingYear,
          caseType: seg.caseType,
          limit: 10,
        },
        totalPages: totalPagesPerSegment,
        createdBy: userId,
      });

      createdJobIds.push(job.id);

      if (isRedisConnected && queues[QUEUE_NAMES.CASE_DISCOVERY]) {
        try {
          await queues[QUEUE_NAMES.CASE_DISCOVERY].add('discoveryJob', { jobId: job.id, campaignId: campaign.id });
        } catch (err) {
          logger.warn(`Could not dispatch backfill segment to Redis queue: ${err.message}`);
        }
      }

      // In-process resilient background executor
      executeDiscoveryJob(job.id).catch((e) => logger.error(`Segment [${job.id}] execution failed`, e));
    }

    await logAuditEvent({
      userId,
      action: 'BACKFILL_CAMPAIGN_LAUNCHED',
      entity: 'BACKFILL_ENGINE',
      entityId: campaign.id,
      details: {
        campaignId: campaign.id,
        name,
        courtCount: courtIds.length,
        yearRange: `${sYear}-${eYear}`,
        totalSegments: totalJobs,
      },
      req,
    });

    logger.info(`[BackfillService] Campaign [${campaign.id}] launched with ${totalJobs} segmented discovery jobs.`);
    return {
      campaign,
      totalJobs,
      jobIds: createdJobIds,
    };
  }

  static async getCampaigns(query) {
    const limit = parseInt(query.limit || '20', 10);
    const offset = parseInt(query.offset || '0', 10);
    return db.getBackfillCampaigns({
      status: query.status || null,
      limit,
      offset,
    });
  }

  static async getCampaignById(id) {
    const campaign = await db.findBackfillCampaignById(id);
    if (!campaign) {
      throw { statusCode: 404, message: `Backfill campaign with ID ${id} not found`, code: 'CAMPAIGN_NOT_FOUND' };
    }
    return campaign;
  }

  static async pauseCampaign(id, userId, req) {
    const campaign = await db.findBackfillCampaignById(id);
    if (!campaign) {
      throw { statusCode: 404, message: `Campaign ${id} not found`, code: 'NOT_FOUND' };
    }

    // Set pause flag on all linked discovery jobs
    for (const seg of campaign.segments || []) {
      if (seg.status === 'RUNNING' || seg.status === 'QUEUED') {
        jobControlFlags.set(seg.id, 'PAUSE');
        await db.updateDiscoveryJob(seg.id, { status: 'PAUSED' });
      }
    }

    const updated = await db.updateBackfillCampaign(id, { status: 'PAUSED' });

    await logAuditEvent({
      userId,
      action: 'BACKFILL_CAMPAIGN_PAUSED',
      entity: 'BACKFILL_ENGINE',
      entityId: id,
      details: { campaignId: id },
      req,
    });

    return updated;
  }

  static async resumeCampaign(id, userId, req) {
    const campaign = await db.findBackfillCampaignById(id);
    if (!campaign) {
      throw { statusCode: 404, message: `Campaign ${id} not found`, code: 'NOT_FOUND' };
    }

    const updated = await db.updateBackfillCampaign(id, { status: 'RUNNING' });

    // Resume all paused segments
    for (const seg of campaign.segments || []) {
      if (seg.status === 'PAUSED') {
        jobControlFlags.delete(seg.id);
        await db.updateDiscoveryJob(seg.id, { status: 'QUEUED' });

        if (isRedisConnected && queues[QUEUE_NAMES.CASE_DISCOVERY]) {
          try {
            await queues[QUEUE_NAMES.CASE_DISCOVERY].add('discoveryJob', { jobId: seg.id, campaignId: id });
          } catch {}
        }
        executeDiscoveryJob(seg.id).catch(() => {});
      }
    }

    await logAuditEvent({
      userId,
      action: 'BACKFILL_CAMPAIGN_RESUMED',
      entity: 'BACKFILL_ENGINE',
      entityId: id,
      details: { campaignId: id },
      req,
    });

    return updated;
  }

  static async retryFailedSegments(id, userId, req) {
    const campaign = await db.findBackfillCampaignById(id);
    if (!campaign) {
      throw { statusCode: 404, message: `Campaign ${id} not found`, code: 'NOT_FOUND' };
    }

    const failedSegments = (campaign.segments || []).filter((s) => s.status === 'FAILED');
    if (failedSegments.length === 0) {
      return { message: 'No failed segments found to retry', retriedCount: 0 };
    }

    await db.updateBackfillCampaign(id, { status: 'RUNNING' });

    for (const seg of failedSegments) {
      jobControlFlags.delete(seg.id);
      await db.updateDiscoveryJob(seg.id, {
        status: 'QUEUED',
        error_message: null,
      });

      if (isRedisConnected && queues[QUEUE_NAMES.CASE_DISCOVERY]) {
        try {
          await queues[QUEUE_NAMES.CASE_DISCOVERY].add('discoveryJob', { jobId: seg.id, campaignId: id });
        } catch {}
      }
      executeDiscoveryJob(seg.id).catch(() => {});
    }

    await logAuditEvent({
      userId,
      action: 'BACKFILL_CAMPAIGN_RETRY_FAILED',
      entity: 'BACKFILL_ENGINE',
      entityId: id,
      details: { campaignId: id, retriedCount: failedSegments.length },
      req,
    });

    return { campaignId: id, retriedCount: failedSegments.length };
  }

  static async cancelCampaign(id, userId, req) {
    const campaign = await db.findBackfillCampaignById(id);
    if (!campaign) {
      throw { statusCode: 404, message: `Campaign ${id} not found`, code: 'NOT_FOUND' };
    }

    // Set cancel flag on all non-completed segments
    for (const seg of campaign.segments || []) {
      if (seg.status !== 'COMPLETED') {
        jobControlFlags.set(seg.id, 'CANCEL');
        await db.updateDiscoveryJob(seg.id, { status: 'CANCELLED' });
      }
    }

    const updated = await db.updateBackfillCampaign(id, {
      status: 'CANCELLED',
      completed_at: new Date().toISOString(),
    });

    await logAuditEvent({
      userId,
      action: 'BACKFILL_CAMPAIGN_CANCELLED',
      entity: 'BACKFILL_ENGINE',
      entityId: id,
      details: { campaignId: id },
      req,
    });

    return updated;
  }

  static async getBackfillStats() {
    return db.getBackfillStats();
  }
}
