"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLimiters = createLimiters;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rate_limit_redis_1 = require("rate-limit-redis");
function createRedisStore(redis, prefix) {
    return new rate_limit_redis_1.RedisStore({
        sendCommand: (command, ...args) => redis.call(command, ...args),
        prefix,
    });
}
function createLimiters(redis) {
    const globalStore = redis ? createRedisStore(redis, 'rl:global:') : undefined;
    const verifyStore = redis ? createRedisStore(redis, 'rl:verify:') : undefined;
    return {
        globalLimiter: (0, express_rate_limit_1.default)({
            windowMs: 15 * 60 * 1000,
            max: 100,
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
            passOnStoreError: true,
            store: globalStore,
        }),
        verifyLimiter: (0, express_rate_limit_1.default)({
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
//# sourceMappingURL=rateLimit.js.map