import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export let isRedisConnected = false;
export let redisError = null;

export const redisConnectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy: (times) => {
    if (times > 5) {
      logger.warn(`Redis connection retry limit reached (${times} attempts). Falling back to resilient mode.`);
      return null; // Stop retrying after 5 attempts
    }
    return Math.min(times * 500, 2000);
  },
};

export const redisClient = new Redis(redisConnectionOptions);

redisClient.on('connect', () => {
  isRedisConnected = true;
  redisError = null;
  logger.info(`Redis connected successfully on ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});

redisClient.on('error', (err) => {
  isRedisConnected = false;
  redisError = err.message;
  logger.warn(`Redis connection issue: ${err.message}`);
});

export const testRedisConnection = async () => {
  try {
    const ping = await redisClient.ping();
    isRedisConnected = ping === 'PONG';
    return isRedisConnected;
  } catch (err) {
    isRedisConnected = false;
    redisError = err.message;
    return false;
  }
};
