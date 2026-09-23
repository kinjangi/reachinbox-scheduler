import { getSharedRedisClient } from '../config/redis';

/**
 * Generates the rate limiting Redis key in the format:
 * ratelimit:{sender}:{YYYY-MM-DDTHH}
 * 
 * @param sender Email address of sender
 * @param date Reference Date object (defaults to now)
 */
export const getRateLimitKey = (sender: string, date: Date = new Date()): string => {
  const iso = date.toISOString(); // e.g., "2026-09-23T11:52:55.123Z"
  const hourPrefix = iso.slice(0, 13); // "2026-09-23T11"
  return `ratelimit:${sender}:${hourPrefix}`;
};

/**
 * Calculates remaining milliseconds until the start of the next hour window.
 */
export const getMsUntilNextHour = (date: Date = new Date()): number => {
  const nextHour = new Date(date);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
  return Math.max(0, nextHour.getTime() - date.getTime());
};

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  delayUntilNextHourMs: number;
  key: string;
}

/**
 * Checks and increments the per-sender hourly rate limit counter in Redis.
 * If the max limit is exceeded, decrements the counter back and returns allowed = false with delay.
 * 
 * @param sender Email address of the sender
 * @param maxLimit Maximum allowed emails per hour for this sender
 */
export const checkAndIncrementRateLimit = async (
  sender: string,
  maxLimit: number,
): Promise<RateLimitCheckResult> => {
  const redis = getSharedRedisClient();
  const key = getRateLimitKey(sender);

  const count = await redis.incr(key);

  // Set 1-hour expiration on the key when created for the first time in this window
  if (count === 1) {
    await redis.expire(key, 3600);
  }

  if (count > maxLimit) {
    // Revert counter increment so this blocked send attempt doesn't consume quota
    await redis.decr(key);
    const delayUntilNextHourMs = getMsUntilNextHour();
    return {
      allowed: false,
      currentCount: count - 1,
      delayUntilNextHourMs,
      key,
    };
  }

  return {
    allowed: true,
    currentCount: count,
    delayUntilNextHourMs: 0,
    key,
  };
};
