import { QueueService } from './queue.service.js';
import { successResponse } from '../../utils/apiResponse.js';

export class QueueController {
  static async getStatus(req, res, next) {
    try {
      const status = await QueueService.getQueueStatus();
      return successResponse(res, 'Queue status retrieved successfully', status);
    } catch (err) {
      next(err);
    }
  }

  static async triggerTest(req, res, next) {
    try {
      const { queueName, payload } = req.body;
      const job = await QueueService.triggerTestJob({ queueName, payload, req });
      return successResponse(res, 'Queue test job dispatched successfully', { job }, 202);
    } catch (err) {
      next(err);
    }
  }
}
