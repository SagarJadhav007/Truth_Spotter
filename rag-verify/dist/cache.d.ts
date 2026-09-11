import { isRedisAvailable } from './redis';
export type CacheEndpoint = 'standard' | 'agentic';
export declare function getCacheTtl(endpoint: CacheEndpoint): number;
export declare function getCachedVerification<T>(endpoint: CacheEndpoint, claim: string): Promise<T | null>;
export declare function setCachedVerification<T>(endpoint: CacheEndpoint, claim: string, result: T, ttlSeconds?: number): Promise<void>;
export declare function invalidateVerificationCache(): Promise<number>;
export { isRedisAvailable };
//# sourceMappingURL=cache.d.ts.map