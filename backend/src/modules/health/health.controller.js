import { HealthService } from './health.service.js';
import { successResponse } from '../../utils/apiResponse.js';

export class HealthController {
  static async getHealth(req, res, next) {
    try {
      const health = await HealthService.getFullHealthStatus();
      return successResponse(res, 'System health report generated', health, 200);
    } catch (err) {
      next(err);
    }
  }
}
