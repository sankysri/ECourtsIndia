import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { testDbConnection, pool } from './config/database.js';
import { testRedisConnection, redisClient } from './config/redis.js';
import { runMigrations } from './database/migrate.js';
import { seedDatabase } from './database/seed.js';
import { initQueues, queues } from './queues/queueManager.js';
import { initSampleWorkers, workers } from './workers/sampleWorker.js';
import { initCourtSyncWorker, courtSyncWorkerInstance } from './workers/courtSyncWorker.js';
import { initDiscoveryWorker, discoveryWorkerInstance } from './workers/discoveryWorker.js';
import { initCaseDetailWorker, caseDetailWorkerInstance } from './workers/caseDetailWorker.js';

const startServer = async () => {
  logger.info('Starting Indian Court Data Ingestion & Intelligence Platform (Backend)...');

  try {
    // 1. Start HTTP Listener immediately on 0.0.0.0 for instant cloud port binding
    const server = app.listen(env.PORT, '0.0.0.0', () => {
      logger.info(`=======================================================`);
      logger.info(`NyayaData Intelligence Backend running on port ${env.PORT}`);
      logger.info(`Health Endpoint: http://0.0.0.0:${env.PORT}/health`);
      logger.info(`Environment:     ${env.NODE_ENV}`);
      logger.info(`=======================================================`);
    });

    // 2. Initialize database, migrations, seeds, Redis and workers in background
    (async () => {
      try {
        await testDbConnection();
        await runMigrations();
        await seedDatabase();

        await testRedisConnection();
        initQueues();
        initSampleWorkers();
        initCourtSyncWorker();
        initDiscoveryWorker();
        initCaseDetailWorker();
        logger.info('System initialization complete (DB, Migrations, Seeds, Workers active).');
      } catch (initErr) {
        logger.error('Non-fatal error during background initialization', initErr);
      }
    })();

    // Graceful Shutdown
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        logger.info('HTTP server closed.');

        // Close BullMQ workers & queues
        for (const worker of Object.values(workers)) {
          await worker.close();
        }
        if (courtSyncWorkerInstance) await courtSyncWorkerInstance.close();
        if (discoveryWorkerInstance) await discoveryWorkerInstance.close();
        if (caseDetailWorkerInstance) await caseDetailWorkerInstance.close();
        for (const queue of Object.values(queues)) {
          await queue.close();
        }

        // Close Redis
        if (redisClient) {
          redisClient.disconnect();
        }

        // Close PostgreSQL pool
        if (pool) {
          await pool.end();
        }

        logger.info('Clean shutdown complete. Exiting process.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (err) {
    logger.error('Fatal error during backend server startup', err);
    process.exit(1);
  }
};

startServer();
