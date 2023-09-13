"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRetries = exports.retryable = exports.RetryParameters = exports.BackoffSettings = void 0;
const errors_1 = require("./errors");
const logging_1 = require("./logging");
const errors = __importStar(require("./errors"));
const utils_1 = require("./utils");
class BackoffSettings {
    backoffCeiling;
    backoffSlotDuration;
    uncertainRatio;
    /**
     * Create backoff settings - uses randomized exponential timeouts with a base of 2
     * Timeout formula: `2^min(retries, backoffCeiling) * backoffSlotDuration * (1 - random() * uncertainRatio)`
     * @param backoffCeiling - max power — (n) in `2^n`
     * @param backoffSlotDuration - multiplier for exponent
     * @param uncertainRatio - timeout fraction that is randomized
     */
    constructor(backoffCeiling, backoffSlotDuration, uncertainRatio = 0.5) {
        this.backoffCeiling = backoffCeiling;
        this.backoffSlotDuration = backoffSlotDuration;
        this.uncertainRatio = uncertainRatio;
    }
    async waitBackoffTimeout(retries) {
        const slotsCount = 1 << Math.min(retries, this.backoffCeiling);
        const maxDuration = slotsCount * this.backoffSlotDuration;
        const duration = maxDuration * (1 - Math.random() * this.uncertainRatio);
        return (0, utils_1.sleep)(duration);
    }
}
exports.BackoffSettings = BackoffSettings;
class RetryParameters {
    retryNotFound;
    unknownErrorHandler;
    maxRetries;
    onYdbErrorCb;
    fastBackoff;
    slowBackoff;
    constructor({ maxRetries = 10, onYdbErrorCb = (_error) => { }, backoffCeiling = 6, backoffSlotDuration = 1000, } = {}) {
        this.maxRetries = maxRetries;
        this.onYdbErrorCb = onYdbErrorCb;
        this.fastBackoff = new BackoffSettings(10, 5);
        this.slowBackoff = new BackoffSettings(backoffCeiling, backoffSlotDuration);
        this.retryNotFound = true;
        this.unknownErrorHandler = () => { };
    }
}
exports.RetryParameters = RetryParameters;
const RETRYABLE_ERRORS_FAST = [
    errors.Unavailable,
    errors.Aborted,
    errors.NotFound,
    errors.TransportUnavailable,
    errors.ClientDeadlineExceeded,
];
const RETRYABLE_ERRORS_SLOW = [errors.Overloaded, errors.ClientResourceExhausted];
class RetryStrategy {
    methodName;
    retryParameters;
    logger;
    constructor(methodName = 'UnknownClass::UnknownMethod', retryParameters, logger) {
        this.methodName = methodName;
        this.retryParameters = retryParameters;
        if (!logger)
            this.logger = (0, logging_1.getLogger)();
        else
            this.logger = logger;
    }
    async retry(asyncMethod) {
        let retries = 0;
        let error;
        const retryParameters = this.retryParameters;
        while (retries < retryParameters.maxRetries) {
            try {
                return await asyncMethod();
            }
            catch (e) {
                if (errors_1.TransportError.isMember(e))
                    e = errors_1.TransportError.convertToYdbError(e);
                error = e;
                if (e instanceof errors_1.YdbError) {
                    const errName = e.constructor.name;
                    const retriesLeft = retryParameters.maxRetries - retries;
                    if (RETRYABLE_ERRORS_FAST.some((cls) => e instanceof cls)) {
                        retryParameters.onYdbErrorCb(e);
                        if (e instanceof errors.NotFound && !retryParameters.retryNotFound) {
                            throw e;
                        }
                        this.logger.warn(`Caught an error ${errName}, retrying with fast backoff, ${retriesLeft} retries left`);
                        await this.retryParameters.fastBackoff.waitBackoffTimeout(retries);
                    }
                    else if (RETRYABLE_ERRORS_SLOW.some((cls) => e instanceof cls)) {
                        retryParameters.onYdbErrorCb(e);
                        this.logger.warn(`Caught an error ${errName}, retrying with slow backoff, ${retriesLeft} retries left`);
                        await this.retryParameters.slowBackoff.waitBackoffTimeout(retries);
                    }
                    else {
                        retryParameters.onYdbErrorCb(e);
                        throw e;
                    }
                }
                else {
                    retryParameters.unknownErrorHandler(e);
                    throw e;
                }
            }
            retries++;
        }
        this.logger.warn('All retries have been used, re-throwing error');
        throw error;
    }
}
function retryable(strategyParams, retryStrategyLogger) {
    return (target, propertyKey, descriptor) => {
        const originalMethod = descriptor.value;
        const wrappedMethodName = `${target.constructor.name}::${propertyKey}`;
        if (!strategyParams)
            strategyParams = new RetryParameters();
        let strategy = new RetryStrategy(wrappedMethodName, strategyParams, retryStrategyLogger);
        descriptor.value = async function (...args) {
            return await strategy.retry(async () => await originalMethod.call(this, ...args));
        };
    };
}
exports.retryable = retryable;
async function withRetries(originalFunction, strategyParams) {
    const wrappedMethodName = originalFunction.name;
    if (!strategyParams) {
        strategyParams = new RetryParameters();
    }
    const strategy = new RetryStrategy(wrappedMethodName, strategyParams);
    return await strategy.retry(originalFunction);
}
exports.withRetries = withRetries;
