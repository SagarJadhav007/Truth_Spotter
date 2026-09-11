import { RateLimitRequestHandler } from 'express-rate-limit';
import type Redis from 'ioredis';
export interface AppLimiters {
    globalLimiter: RateLimitRequestHandler;
    verifyLimiter: RateLimitRequestHandler;
}
export declare function createLimiters(redis: Redis | null): AppLimiters;
//# sourceMappingURL=rateLimit.d.ts.map