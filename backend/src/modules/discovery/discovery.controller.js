import { DiscoveryService } from './discovery.service.js';
import { successResponse } from '../../utils/apiResponse.js';

export class DiscoveryController {
  static async createJob(req, res, next) {
    try {
      const { courtId, strategy, filters } = req.body;
      const job = await DiscoveryService.createJob({
        courtId,
        strategy,
        filters,
        createdBy: req.user?.id,
        req,
      });
      return successResponse(res, 'Discovery job created and enqueued', { job }, 202);
    } catch (err) {
      next(err);
    }
  }

  static async getJobs(req, res, next) {
    try {
      const result = await DiscoveryService.getJobs(req.query);
      return successResponse(res, 'Discovery jobs retrieved', result);
    } catch (err) {
      next(err);
    }
  }

  static async getJobById(req, res, next) {
    try {
      const job = await DiscoveryService.getJobById(req.params.id);
      return successResponse(res, 'Discovery job details retrieved', { job });
    } catch (err) {
      next(err);
    }
  }

  static async pauseJob(req, res, next) {
    try {
      const job = await DiscoveryService.pauseJob(req.params.id, req.user?.id, req);
      return successResponse(res, 'Discovery job paused', { job });
    } catch (err) {
      next(err);
    }
  }

  static async resumeJob(req, res, next) {
    try {
      const job = await DiscoveryService.resumeJob(req.params.id, req.user?.id, req);
      return successResponse(res, 'Discovery job resumed', { job });
    } catch (err) {
      next(err);
    }
  }

  static async retryJob(req, res, next) {
    try {
      const job = await DiscoveryService.retryJob(req.params.id, req.user?.id, req);
      return successResponse(res, 'Discovery job retrying', { job });
    } catch (err) {
      next(err);
    }
  }

  static async cancelJob(req, res, next) {
    try {
      const job = await DiscoveryService.cancelJob(req.params.id, req.user?.id, req);
      return successResponse(res, 'Discovery job cancelled', { job });
    } catch (err) {
      next(err);
    }
  }

  static async getRegistry(req, res, next) {
    try {
      const result = await DiscoveryService.getRegistry(req.query);
      return successResponse(res, 'Discovered case registry retrieved', result);
    } catch (err) {
      next(err);
    }
  }

  static async getRegistryStats(req, res, next) {
    try {
      const stats = await DiscoveryService.getRegistryStats();
      return successResponse(res, 'Discovery registry metrics retrieved', { stats });
    } catch (err) {
      next(err);
    }
  }

  static async getFiltersMetadata(req, res, next) {
    try {
      const metadata = await DiscoveryService.getFiltersMetadata();
      return successResponse(res, 'Discovery filters metadata retrieved', metadata);
    } catch (err) {
      next(err);
    }
  }

  // Milestone 6 Daily Discovery Controllers
  static async getDailyStatus(req, res, next) {
    try {
      const status = await DiscoveryService.getDailyStatus();
      return successResponse(res, 'Daily discovery status retrieved', { status });
    } catch (err) {
      next(err);
    }
  }

  static async updateDailyConfig(req, res, next) {
    try {
      const config = await DiscoveryService.updateDailyConfig(req.body, req.user?.id, req);
      return successResponse(res, 'Daily discovery configuration updated', { config });
    } catch (err) {
      next(err);
    }
  }

  static async triggerDailyDiscovery(req, res, next) {
    try {
      const { lookbackWindow, courtIds } = req.body || {};
      const result = await DiscoveryService.triggerDailyDiscovery({
        lookbackWindow,
        courtIds,
        userId: req.user?.id,
        req,
      });
      return successResponse(res, 'Daily discovery run initiated', result, 202);
    } catch (err) {
      next(err);
    }
  }

  static async getDailyHistory(req, res, next) {
    try {
      const history = await DiscoveryService.getDailyHistory(req.query);
      return successResponse(res, 'Daily discovery history retrieved', history);
    } catch (err) {
      next(err);
    }
  }
}
