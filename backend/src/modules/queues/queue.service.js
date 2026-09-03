import { getQueueHealth, dispatchTestJob, QUEUE_NAMES } from '../../queues/queueManager.js';
import { logAuditEvent } from '../../middleware/audit.js';

export class QueueService {
  static async getQueueStatus() {
    return getQueueHealth();
  }

  static async triggerTestJob({ queueName, payload, req }) {
    const jobResult = await dispatchTestJob(queueName, payload);

    await logAuditEvent({
      userId: req?.user?.id,
      action: 'QUEUE_TEST_JOB_DISPATCHED',
      entity: 'BULLMQ_QUEUE',
      entityId: queueName || QUEUE_NAMES.CASE_DISCOVERY,
      details: { jobId: jobResult.jobId, queue: queueName },
      req,
    });

    return jobResult;
  }
}
