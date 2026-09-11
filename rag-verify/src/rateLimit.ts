import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type Redis from 'ioredis';

export interface AppLimiters {
  globalLimiter: RateLimitRequestHandler;
  verifyLimiter: RateLimitRequestHandler;
}

function createRedisStore(redis: Redis, prefix: string): RedisStore {
  return new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as Promise<RedisReply>,
    prefix,
  });
}

export function createLimiters(redis: Redis | null): AppLimiters {
  const globalStore = redis ? createRedisStore(redis, 'rl:global:') : undefined;
  const verifyStore = redis ? createRedisStore(redis, 'rl:verify:') : undefined;

  return {
    globalLimiter: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      passOnStoreError: true,
      store: globalStore,
    }),
    verifyLimiter: rateLimit({
      windowMs: 5 * 60 * 1000,
      max: 10,
      message: 'Too many verification requests, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      passOnStoreError: true,
      store: verifyStore,
    }),
  };
}
