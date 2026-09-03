import { BackfillService } from './backfill.service.js';
import { successResponse } from '../../utils/apiResponse.js';

export class BackfillController {
  static async createCampaign(req, res, next) {
    try {
      const result = await BackfillService.createCampaign({
        ...req.body,
        userId: req.user?.id,
        req,
      });
      return successResponse(res, 'Backfill campaign created and segmented jobs dispatched', result, 202);
    } catch (err) {
      next(err);
    }
  }

  static async getCampaigns(req, res, next) {
    try {
      const result = await BackfillService.getCampaigns(req.query);
      return successResponse(res, 'Backfill campaigns retrieved', result);
    } catch (err) {
      next(err);
    }
  }

  static async getCampaignById(req, res, next) {
    try {
      const result = await BackfillService.getCampaignById(req.params.id);
      return successResponse(res, 'Campaign details retrieved', { campaign: result });
    } catch (err) {
      next(err);
    }
  }

  static async pauseCampaign(req, res, next) {
    try {
      const result = await BackfillService.pauseCampaign(req.params.id, req.user?.id, req);
      return successResponse(res, 'Campaign paused successfully', { campaign: result });
    } catch (err) {
      next(err);
    }
  }

  static async resumeCampaign(req, res, next) {
    try {
      const result = await BackfillService.resumeCampaign(req.params.id, req.user?.id, req);
      return successResponse(res, 'Campaign resumed successfully', { campaign: result });
    } catch (err) {
      next(err);
    }
  }

  static async retryFailedSegments(req, res, next) {
    try {
      const result = await BackfillService.retryFailedSegments(req.params.id, req.user?.id, req);
      return successResponse(res, 'Failed segments retried', result);
    } catch (err) {
      next(err);
    }
  }

  static async cancelCampaign(req, res, next) {
    try {
      const result = await BackfillService.cancelCampaign(req.params.id, req.user?.id, req);
      return successResponse(res, 'Campaign cancelled', { campaign: result });
    } catch (err) {
      next(err);
    }
  }

  static async getStats(req, res, next) {
    try {
      const result = await BackfillService.getBackfillStats();
      return successResponse(res, 'Backfill engine statistics', result);
    } catch (err) {
      next(err);
    }
  }
}
