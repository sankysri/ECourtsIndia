import { CourtsService } from './courts.service.js';
import { successResponse } from '../../utils/apiResponse.js';

export class CourtsController {
  static async getCourts(req, res, next) {
    try {
      const result = await CourtsService.getCourts(req.query);
      return successResponse(res, 'Courts retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  static async getCourtById(req, res, next) {
    try {
      const court = await CourtsService.getCourtById(req.params.id);
      return successResponse(res, 'Court details retrieved', { court });
    } catch (err) {
      next(err);
    }
  }

  static async getHierarchy(req, res, next) {
    try {
      const hierarchy = await CourtsService.getCourtHierarchy();
      return successResponse(res, 'Court hierarchy retrieved', { hierarchy });
    } catch (err) {
      next(err);
    }
  }

  static async getMetadata(req, res, next) {
    try {
      const metadata = await CourtsService.getMetadata();
      return successResponse(res, 'Court metadata and reference enums retrieved', metadata);
    } catch (err) {
      next(err);
    }
  }

  static async getCourtLogs(req, res, next) {
    try {
      const logs = await CourtsService.getCourtLogs(req.params.code, parseInt(req.query.limit || '20', 10));
      return successResponse(res, 'Court API logs retrieved', { logs });
    } catch (err) {
      next(err);
    }
  }

  static async triggerSync(req, res, next) {
    try {
      const syncResult = await CourtsService.triggerCourtSync({ userId: req.user?.id, req });
      return successResponse(res, 'Court synchronization job initiated', syncResult, 202);
    } catch (err) {
      next(err);
    }
  }

  static async getSyncStatus(req, res, next) {
    try {
      const status = await CourtsService.getSyncJobStatus(req.params.jobId);
      return successResponse(res, 'Sync job status retrieved', { syncJob: status });
    } catch (err) {
      next(err);
    }
  }
}
