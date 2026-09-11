"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRedisEnabled = isRedisEnabled;
exports.initRedis = initRedis;
exports.getRedis = getRedis;
exports.isRedisAvailable = isRedisAvailable;
exports.closeRedis = closeRedis;
require("dotenv/config");
const ioredis_1 = __importDefault(require("ioredis"));
let redis = null;
let redisAvailable = false;
function isRedisEnabled() {
    return process.env.REDIS_ENABLED !== 'false' && Boolean(process.env.REDIS_URL);
}
async function initRedis() {
    if (!isRedisEnabled()) {
        console.log('⚠️  Redis disabled — using in-memory rate limits, no response cache');
        return null;
    }
    try {
        const client = new ioredis_1.default(process.env.REDIS_URL, {
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️  Redis unavailable — falling back to in-memory: ${message}`);
        redis = null;
        redisAvailable = false;
        return null;
    }
}
function getRedis() {
    return redisAvailable ? redis : null;
}
function isRedisAvailable() {
    return redisAvailable;
}
async function closeRedis() {
    if (redis) {
        await redis.quit();
        redis = null;
        redisAvailable = false;
    }
}
//# sourceMappingURL=redis.js.map