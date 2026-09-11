import 'dotenv/config';
import Redis from 'ioredis';

let redis: Redis | null = null;
let redisAvailable = false;

export function isRedisEnabled(): boolean {
  return process.env.REDIS_ENABLED !== 'false' && Boolean(process.env.REDIS_URL);
}

export async function initRedis(): Promise<Redis | null> {
  if (!isRedisEnabled()) {
    console.log('⚠️  Redis disabled — using in-memory rate limits, no response cache');
    return null;
  }

  try {
    const client = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    client.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
      redisAvailable = false;
    });

    await client.connect();
    await client.ping();

    redis = client;
    redisAvailable = true;
    console.log('✅ Redis connected');
    return client;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Redis unavailable — falling back to in-memory: ${message}`);
    redis = null;
    redisAvailable = false;
    return null;
  }
}

export function getRedis(): Redis | null {
  return redisAvailable ? redis : null;
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    redisAvailable = false;
  }
}
