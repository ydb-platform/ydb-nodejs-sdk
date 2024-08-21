"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRetries = exports.retryable = exports.RetryParameters = exports.BackoffSettings = void 0;
var errors_1 = require("./errors");
var errors = require("./errors");
var utils = require("./utils");
// import {getDefaultLogger} from "./logger/get-default-logger";
var BackoffSettings = /** @class */ (function () {
    /**
     * Create backoff settings - uses randomized exponential timeouts with a base of 2
     * Timeout formula: `2^min(retries, backoffCeiling) * backoffSlotDuration * (1 - random() * uncertainRatio)`
     * @param backoffCeiling - max power — (n) in `2^n`
     * @param backoffSlotDuration - multiplier for exponent
     * @param uncertainRatio - timeout fraction that is randomized
     */
    function BackoffSettings(backoffCeiling, backoffSlotDuration, uncertainRatio) {
        if (uncertainRatio === void 0) { uncertainRatio = 0.5; }
        this.backoffCeiling = backoffCeiling;
        this.backoffSlotDuration = backoffSlotDuration;
        this.uncertainRatio = uncertainRatio;
    }
    BackoffSettings.prototype.waitBackoffTimeout = function (retries) {
        return __awaiter(this, void 0, void 0, function () {
            var slotsCount, maxDuration, duration;
            return __generator(this, function (_a) {
                slotsCount = 1 << Math.min(retries, this.backoffCeiling);
                maxDuration = slotsCount * this.backoffSlotDuration;
                duration = maxDuration * (1 - Math.random() * this.uncertainRatio);
                return [2 /*return*/, utils.sleep(duration)];
            });
        });
    };
    return BackoffSettings;
}());
exports.BackoffSettings = BackoffSettings;
var RetryParameters = /** @class */ (function () {
    function RetryParameters(_a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.maxRetries, maxRetries = _c === void 0 ? 10 : _c, _d = _b.onYdbErrorCb, onYdbErrorCb = _d === void 0 ? function (_error) { } : _d, _e = _b.backoffCeiling, backoffCeiling = _e === void 0 ? 6 : _e, _f = _b.backoffSlotDuration, backoffSlotDuration = _f === void 0 ? 1000 : _f;
        this.maxRetries = maxRetries;
        this.onYdbErrorCb = onYdbErrorCb;
        this.fastBackoff = new BackoffSettings(10, 5);
        this.slowBackoff = new BackoffSettings(backoffCeiling, backoffSlotDuration);
        this.retryNotFound = true;
        this.unknownErrorHandler = function () { };
    }
    return RetryParameters;
}());
exports.RetryParameters = RetryParameters;
var RETRYABLE_ERRORS_FAST = [
    errors.Unavailable,
    errors.Aborted,
    errors.NotFound,
    errors.TransportUnavailable,
    errors.ClientDeadlineExceeded,
];
var RETRYABLE_ERRORS_SLOW = [errors.Overloaded, errors.ClientResourceExhausted];
var RetryStrategy = /** @class */ (function () {
    // private logger: Logger;
    function RetryStrategy(methodName, retryParameters, _logger) {
        if (methodName === void 0) { methodName = 'UnknownClass::UnknownMethod'; }
        this.methodName = methodName;
        this.retryParameters = retryParameters;
        // this.logger = logger ?? getDefaultLogger();
    }
    RetryStrategy.prototype.retry = function (asyncMethod) {
        return __awaiter(this, void 0, void 0, function () {
            var retries, error, retryParameters, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        retries = 0;
                        retryParameters = this.retryParameters;
                        _a.label = 1;
                    case 1:
                        if (!(retries < retryParameters.maxRetries)) return [3 /*break*/, 13];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 12]);
                        return [4 /*yield*/, asyncMethod()];
                    case 3: return [2 /*return*/, _a.sent()];
                    case 4:
                        e_1 = _a.sent();
                        if (errors_1.TransportError.isMember(e_1))
                            e_1 = errors_1.TransportError.convertToYdbError(e_1);
                        error = e_1;
                        if (!(e_1 instanceof errors_1.YdbError)) return [3 /*break*/, 10];
                        if (!RETRYABLE_ERRORS_FAST.some(function (cls) { return e_1 instanceof cls; })) return [3 /*break*/, 6];
                        retryParameters.onYdbErrorCb(e_1);
                        if (e_1 instanceof errors.NotFound && !retryParameters.retryNotFound) {
                            throw e_1;
                        }
                        // this.logger.warn(
                        //     `Caught an error ${errName}, retrying with fast backoff, ${retriesLeft} retries left`,
                        // );
                        return [4 /*yield*/, this.retryParameters.fastBackoff.waitBackoffTimeout(retries)];
                    case 5:
                        // this.logger.warn(
                        //     `Caught an error ${errName}, retrying with fast backoff, ${retriesLeft} retries left`,
                        // );
                        _a.sent();
                        return [3 /*break*/, 9];
                    case 6:
                        if (!RETRYABLE_ERRORS_SLOW.some(function (cls) { return e_1 instanceof cls; })) return [3 /*break*/, 8];
                        retryParameters.onYdbErrorCb(e_1);
                        // this.logger.warn(
                        //     `Caught an error ${errName}, retrying with slow backoff, ${retriesLeft} retries left`,
                        // );
                        return [4 /*yield*/, this.retryParameters.slowBackoff.waitBackoffTimeout(retries)];
                    case 7:
                        // this.logger.warn(
                        //     `Caught an error ${errName}, retrying with slow backoff, ${retriesLeft} retries left`,
                        // );
                        _a.sent();
                        return [3 /*break*/, 9];
                    case 8:
                        retryParameters.onYdbErrorCb(e_1);
                        throw e_1;
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        retryParameters.unknownErrorHandler(e_1);
                        throw e_1;
                    case 11: return [3 /*break*/, 12];
                    case 12:
                        retries++;
                        return [3 /*break*/, 1];
                    case 13: 
                    // this.logger.warn('All retries have been used, re-throwing error');
                    throw error;
                }
            });
        });
    };
    return RetryStrategy;
}());
function retryable(strategyParams, retryStrategyLogger) {
    return function (target, propertyKey, descriptor) {
        var originalMethod = descriptor.value;
        var wrappedMethodName = "".concat(target.constructor.name, "::").concat(propertyKey);
        if (!strategyParams)
            strategyParams = new RetryParameters();
        var strategy = new RetryStrategy(wrappedMethodName, strategyParams, retryStrategyLogger);
        descriptor.value = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return __awaiter(this, void 0, void 0, function () {
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, strategy.retry(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, originalMethod.call.apply(originalMethod, __spreadArray([this], args, false))];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            }); }); })];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
    };
}
exports.retryable = retryable;
function withRetries(originalFunction, strategyParams) {
    return __awaiter(this, void 0, void 0, function () {
        var wrappedMethodName, strategy;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    wrappedMethodName = originalFunction.name;
                    if (!strategyParams) {
                        strategyParams = new RetryParameters();
                    }
                    strategy = new RetryStrategy(wrappedMethodName, strategyParams);
                    return [4 /*yield*/, strategy.retry(originalFunction)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
exports.withRetries = withRetries;
