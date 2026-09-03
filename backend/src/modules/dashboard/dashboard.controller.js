import { DashboardService } from './dashboard.service.js';
import { successResponse } from '../../utils/apiResponse.js';

export class DashboardController {
  static async getSummary(req, res, next) {
    try {
      const summary = await DashboardService.getSummary();
      return successResponse(res, 'Dashboard summary retrieved successfully', summary, 200);
    } catch (err) {
      next(err);
    }
  }

  static async getSystemHealth(req, res, next) {
    try {
      const health = await DashboardService.getSystemHealth();
      return successResponse(res, 'System health telemetry retrieved', health, 200);
    } catch (err) {
      next(err);
    }
  }

  static async getRecentActivity(req, res, next) {
    try {
      const limit = parseInt(req.query.limit || '15', 10);
      const activity = await DashboardService.getRecentActivity(limit);
      return successResponse(res, 'Recent activity retrieved', activity, 200);
    } catch (err) {
      next(err);
    }
  }

  static async getQueueStatus(req, res, next) {
    try {
      const queues = await DashboardService.getQueueStatus();
      return successResponse(res, 'Queue status retrieved', queues, 200);
    } catch (err) {
      next(err);
    }
  }
}
