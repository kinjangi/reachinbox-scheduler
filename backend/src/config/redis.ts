import Redis from 'ioredis';
import { ConnectionOptions } from 'bullmq';
import { config } from './env';

export const getRedisConnectionOptions = (): ConnectionOptions => {
  if (config.redisUrl.startsWith('redis://') || config.redisUrl.startsWith('rediss://')) {
    const url = new URL(config.redisUrl);
    return {
      host: url.hostname || 'localhost',
      port: parseInt(url.port || '6379', 10),
      username: url.username || undefined,
      password: url.password || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }

  return {
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
};

let sharedRedisClient: Redis | null = null;

export const getSharedRedisClient = (): Redis => {
  if (!sharedRedisClient) {
    sharedRedisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return sharedRedisClient;
};
