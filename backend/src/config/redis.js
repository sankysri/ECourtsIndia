import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export let isRedisConnected = false;
export let redisError = null;

export const redisConnectionOptions = env.REDIS_URL
  ? {
      url: env.REDIS_URL,
      tls: env.REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 5) {
          logger.warn(`Redis connection retry limit reached (${times} attempts). Falling back to resilient mode.`);
          return null;
        }
        return Math.min(times * 500, 2000);
      },
    }
  : {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      tls: env.REDIS_TLS ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 5) {
          logger.warn(`Redis connection retry limit reached (${times} attempts). Falling back to resilient mode.`);
          return null;
        }
        return Math.min(times * 500, 2000);
      },
    };

export const redisClient = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: env.REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    })
  : new Redis(redisConnectionOptions);

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
