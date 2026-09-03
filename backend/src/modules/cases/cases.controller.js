import { CasesService } from './cases.service.js';
import { successResponse } from '../../utils/apiResponse.js';

export class CasesController {
  static async getCases(req, res, next) {
    try {
      const result = await CasesService.getCases(req.query);
      return successResponse(res, 'Cases retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  static async getCaseByCnr(req, res, next) {
    try {
      const result = await CasesService.getCaseByCnr(req.params.cnr);
      return successResponse(res, 'Case dossier retrieved', result);
    } catch (err) {
      next(err);
    }
  }

  static async getRawCaseSource(req, res, next) {
    try {
      const raw = await CasesService.getRawCaseSource(req.params.cnr);
      return successResponse(res, 'Raw API source payload retrieved', { raw });
    } catch (err) {
      next(err);
    }
  }

  static async triggerCaseDetailSync(req, res, next) {
    try {
      const result = await CasesService.triggerCaseDetailSync(req.params.cnr, req.user?.id, req);
      return successResponse(res, 'Case detail sync initiated', result, 202);
    } catch (err) {
      next(err);
    }
  }

  static async batchSyncPendingCases(req, res, next) {
    try {
      const limit = parseInt(req.body.limit || '10', 10);
      const result = await CasesService.batchSyncPendingCases(limit, req.user?.id, req);
      return successResponse(res, 'Batch detail synchronization dispatched', result, 202);
    } catch (err) {
      next(err);
    }
  }
}
