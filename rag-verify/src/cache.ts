import crypto from 'crypto';
import { getRedis, isRedisAvailable } from './redis';

export type CacheEndpoint = 'standard' | 'agentic';

function normalizeClaim(claim: string): string {
  return claim.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildCacheKey(endpoint: CacheEndpoint, claim: string): string {
  const hash = crypto.createHash('sha256').update(normalizeClaim(claim)).digest('hex');
  return `verify:${endpoint}:${hash}`;
}

export function getCacheTtl(endpoint: CacheEndpoint): number {
  if (endpoint === 'agentic') {
    return parseInt(process.env.CACHE_TTL_AGENTIC_SECONDS || '3600', 10);
  }
  return parseInt(process.env.CACHE_TTL_SECONDS || '7200', 10);
}

export async function getCachedVerification<T>(
  endpoint: CacheEndpoint,
  claim: string
): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;

  try {
    const data = await client.get(buildCacheKey(endpoint, claim));
    return data ? (JSON.parse(data) as T) : null;
  } catch (error) {
    console.warn('⚠️  Cache read failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function setCachedVerification<T>(
  endpoint: CacheEndpoint,
  claim: string,
  result: T,
  ttlSeconds?: number
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    const ttl = ttlSeconds ?? getCacheTtl(endpoint);
    await client.setex(buildCacheKey(endpoint, claim), ttl, JSON.stringify(result));
  } catch (error) {
    console.warn('⚠️  Cache write failed:', error instanceof Error ? error.message : error);
  }
}

export async function invalidateVerificationCache(): Promise<number> {
  const client = getRedis();
  if (!client) return 0;

  let deleted = 0;

  try {
    for (const prefix of ['verify:standard:', 'verify:agentic:']) {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          deleted += await client.del(...keys);
        }
      } while (cursor !== '0');
    }
  } catch (error) {
    console.warn('⚠️  Cache invalidation failed:', error instanceof Error ? error.message : error);
  }

  return deleted;
}

export { isRedisAvailable };
