import { redisClient, isRedisConnected } from '../../config/redis.js';
import { db } from '../../database/datastore.js';
import { logger } from '../../utils/logger.js';

/**
 * Centralized Redis Rate Limiter for eCourtsIndia API
 * Dynamically enforces sliding-window & concurrency constraints from system_settings.
 */
class MemoryRateLimiter {
  constructor() {
    this.requests = [];
    this.activeConcurrent = 0;
  }

  reset() {
    this.requests = [];
    this.activeConcurrent = 0;
  }

  async acquire(limits) {
    const now = Date.now();
    this.requests = this.requests.filter((t) => now - t < 86400000);

    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    const countMin = this.requests.filter((t) => t > oneMinuteAgo).length;
    const countHour = this.requests.filter((t) => t > oneHourAgo).length;
    const countDay = this.requests.filter((t) => t > oneDayAgo).length;

    if (this.activeConcurrent >= limits.maxConcurrent) {
      return { allowed: false, reason: `Max concurrent requests (${limits.maxConcurrent}) reached`, retryAfterMs: 250 };
    }
    if (countMin >= limits.perMinute) {
      return { allowed: false, reason: `Rate limit of ${limits.perMinute} requests/min reached`, retryAfterMs: 500 };
    }
    if (countHour >= limits.perHour) {
      return { allowed: false, reason: `Rate limit of ${limits.perHour} requests/hour reached`, retryAfterMs: 2000 };
    }
    if (countDay >= limits.perDay) {
      return { allowed: false, reason: `Daily limit of ${limits.perDay} requests/day reached`, retryAfterMs: 30000 };
    }

    this.requests.push(now);
    this.activeConcurrent += 1;
    return { allowed: true };
  }

  release() {
    if (this.activeConcurrent > 0) this.activeConcurrent -= 1;
  }
}

const memoryLimiter = new MemoryRateLimiter();

export class RateLimiter {
  static async getDynamicLimits() {
    try {
      const minSetting = await db.getSettingByKey('api_requests_per_minute');
      const hourSetting = await db.getSettingByKey('api_requests_per_hour');
      const daySetting = await db.getSettingByKey('api_requests_per_day');
      const concurrentSetting = await db.getSettingByKey('api_max_concurrent_requests');

      return {
        perMinute: Number(minSetting?.value ?? 600),
        perHour: Number(hourSetting?.value ?? 10000),
        perDay: Number(daySetting?.value ?? 50000),
        maxConcurrent: Number(concurrentSetting?.value ?? 25),
      };
    } catch (err) {
      logger.warn('Could not fetch dynamic rate limits, using safe defaults', err);
      return {
        perMinute: 600,
        perHour: 10000,
        perDay: 50000,
        maxConcurrent: 25,
      };
    }
  }

  static async reset() {
    memoryLimiter.reset();
    if (isRedisConnected) {
      try {
        const keys = await redisClient.keys('ecourts:ratelimit:*');
        if (keys && keys.length > 0) {
          await redisClient.del(...keys);
        }
      } catch {}
    }
  }

  /**
   * Acquire a rate limit token before dispatching an eCourts API call.
   */
  static async acquire() {
    const limits = await this.getDynamicLimits();

    if (!isRedisConnected) {
      return memoryLimiter.acquire(limits);
    }

    const now = Date.now();
    const keyMin = `ecourts:ratelimit:min:${Math.floor(now / 60000)}`;
    const keyHour = `ecourts:ratelimit:hour:${Math.floor(now / 3600000)}`;
    const keyDay = `ecourts:ratelimit:day:${Math.floor(now / 86400000)}`;
    const keyConcurrent = `ecourts:ratelimit:concurrent`;

    try {
      // 1. Check concurrent in-flight requests
      const activeConcurrent = parseInt((await redisClient.get(keyConcurrent)) || '0', 10);
      if (activeConcurrent >= limits.maxConcurrent) {
        return {
          allowed: false,
          reason: `Max concurrent requests (${limits.maxConcurrent}) reached`,
          retryAfterMs: 250,
        };
      }

      // 2. Increment and check minute window
      const countMin = await redisClient.incr(keyMin);
      if (countMin === 1) await redisClient.expire(keyMin, 65);
      if (countMin > limits.perMinute) {
        return {
          allowed: false,
          reason: `Rate limit of ${limits.perMinute} req/min reached`,
          retryAfterMs: 500,
        };
      }

      // 3. Increment and check hour window
      const countHour = await redisClient.incr(keyHour);
      if (countHour === 1) await redisClient.expire(keyHour, 3660);
      if (countHour > limits.perHour) {
        return {
          allowed: false,
          reason: `Hourly rate limit of ${limits.perHour} req/hour reached`,
          retryAfterMs: 2000,
        };
      }

      // 4. Increment and check day window
      const countDay = await redisClient.incr(keyDay);
      if (countDay === 1) await redisClient.expire(keyDay, 86500);
      if (countDay > limits.perDay) {
        return {
          allowed: false,
          reason: `Daily rate limit of ${limits.perDay} req/day reached`,
          retryAfterMs: 30000,
        };
      }

      // 5. Register active concurrent request with self-healing 15s expiry
      await redisClient.incr(keyConcurrent);
      await redisClient.expire(keyConcurrent, 15);
      return { allowed: true };
    } catch (err) {
      logger.warn(`Redis rate limiter check failed (${err.message}). Falling back to memory limiter.`);
      return memoryLimiter.acquire(limits);
    }
  }

  /**
   * Release active concurrency slot after request completes.
   */
  static async release() {
    if (!isRedisConnected) {
      memoryLimiter.release();
      return;
    }

    try {
      const keyConcurrent = `ecourts:ratelimit:concurrent`;
      const current = await redisClient.decr(keyConcurrent);
      if (current < 0) {
        await redisClient.set(keyConcurrent, 0);
      }
    } catch (err) {
      memoryLimiter.release();
    }
  }
}
