import 'dotenv/config';
import Redis from 'ioredis';
export declare function isRedisEnabled(): boolean;
export declare function initRedis(): Promise<Redis | null>;
export declare function getRedis(): Redis | null;
export declare function isRedisAvailable(): boolean;
export declare function closeRedis(): Promise<void>;
//# sourceMappingURL=redis.d.ts.map