import { Worker } from 'bullmq';
import { redisConnectionOptions, isRedisConnected } from '../config/redis.js';
import { QUEUE_NAMES, inMemoryJobTelemetry } from '../queues/queueManager.js';
import { logger } from '../utils/logger.js';

export const workers = {};

export const initSampleWorkers = () => {
  logger.info('Initializing BullMQ Sample Workers...');
  
  if (!isRedisConnected) {
    logger.info('Redis is not connected. Sample workers standby mode active.');
    return;
  }

  // Dedicated workers handle COURT_SYNC, CASE_DISCOVERY, & CASE_DETAIL; sample workers handle remaining queues
  const sampleQueueNames = [
    QUEUE_NAMES.CASE_SYNC,
    QUEUE_NAMES.DOCUMENT,
    QUEUE_NAMES.INDEX,
  ];

  for (const queueName of sampleQueueNames) {
    try {
      workers[queueName] = new Worker(
        queueName,
        async (job) => {
          logger.info(`[Worker:${queueName}] Processing job [${job.id}] - type: ${job.name}`, job.data);
          
          await new Promise((resolve) => setTimeout(resolve, 50));
          
          const result = {
            success: true,
            jobId: job.id,
            queue: queueName,
            processedAt: new Date().toISOString(),
            message: `Sample test job processed successfully for ${queueName}`,
          };

          inMemoryJobTelemetry.totalCompleted += 1;
          inMemoryJobTelemetry.recentJobs.unshift({
            jobId: job.id,
            queue: queueName,
            status: 'completed',
            data: job.data,
            result,
            completedAt: new Date().toISOString(),
          });
          if (inMemoryJobTelemetry.recentJobs.length > 50) inMemoryJobTelemetry.recentJobs.pop();

          logger.info(`[Worker:${queueName}] Job [${job.id}] finished successfully.`);
          return result;
        },
        {
          connection: redisConnectionOptions,
          concurrency: 5,
        }
      );

      workers[queueName].on('failed', (job, err) => {
        logger.error(`[Worker:${queueName}] Job [${job?.id}] failed: ${err.message}`);
        inMemoryJobTelemetry.totalFailed += 1;
      });

      logger.info(`BullMQ Worker started for [${queueName}]`);
    } catch (err) {
      logger.warn(`Could not start worker for ${queueName}: ${err.message}`);
    }
  }
};
