"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRedisAvailable = void 0;
exports.getCacheTtl = getCacheTtl;
exports.getCachedVerification = getCachedVerification;
exports.setCachedVerification = setCachedVerification;
exports.invalidateVerificationCache = invalidateVerificationCache;
const crypto_1 = __importDefault(require("crypto"));
const redis_1 = require("./redis");
Object.defineProperty(exports, "isRedisAvailable", { enumerable: true, get: function () { return redis_1.isRedisAvailable; } });
function normalizeClaim(claim) {
    return claim.trim().toLowerCase().replace(/\s+/g, ' ');
}
function buildCacheKey(endpoint, claim) {
    const hash = crypto_1.default.createHash('sha256').update(normalizeClaim(claim)).digest('hex');
    return `verify:${endpoint}:${hash}`;
}
function getCacheTtl(endpoint) {
    if (endpoint === 'agentic') {
        return parseInt(process.env.CACHE_TTL_AGENTIC_SECONDS || '3600', 10);
    }
    return parseInt(process.env.CACHE_TTL_SECONDS || '7200', 10);
}
async function getCachedVerification(endpoint, claim) {
    const client = (0, redis_1.getRedis)();
    if (!client)
        return null;
    try {
        const data = await client.get(buildCacheKey(endpoint, claim));
        return data ? JSON.parse(data) : null;
    }
    catch (error) {
        console.warn('⚠️  Cache read failed:', error instanceof Error ? error.message : error);
        return null;
    }
}
async function setCachedVerification(endpoint, claim, result, ttlSeconds) {
    const client = (0, redis_1.getRedis)();
    if (!client)
        return;
    try {
        const ttl = ttlSeconds ?? getCacheTtl(endpoint);
        await client.setex(buildCacheKey(endpoint, claim), ttl, JSON.stringify(result));
    }
    catch (error) {
        console.warn('⚠️  Cache write failed:', error instanceof Error ? error.message : error);
    }
}
async function invalidateVerificationCache() {
    const client = (0, redis_1.getRedis)();
    if (!client)
        return 0;
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
    }
    catch (error) {
        console.warn('⚠️  Cache invalidation failed:', error instanceof Error ? error.message : error);
    }
    return deleted;
}
//# sourceMappingURL=cache.js.map