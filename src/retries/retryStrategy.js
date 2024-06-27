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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryStrategy = void 0;
var errors_1 = require("../errors");
var symbols_1 = require("./symbols");
var utils = require("../utils");
var message_1 = require("./message");
;
var RetryStrategy = /** @class */ (function () {
    function RetryStrategy(
    // public methodName = 'UnknownClass::UnknownMethod',
    retryParameters, logger) {
        this.retryParameters = retryParameters;
        this.logger = logger;
    }
    RetryStrategy.prototype.retry = function (_ctx, fn) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, _ctx.wrap({ timeout: this.retryParameters.timeout }, function (ctx) { return __awaiter(_this, void 0, void 0, function () {
                        var attemptsCounter, prevError, sameErrorCount, maxRetries, r, err_1, retryPolicy, backoff, waitFor;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    attemptsCounter = 0;
                                    sameErrorCount = 0;
                                    maxRetries = this.retryParameters.maxRetries;
                                    _a.label = 1;
                                case 1:
                                    if (!true) return [3 /*break*/, 12];
                                    if (maxRetries !== 0 && attemptsCounter >= maxRetries) { // to support the old logic for a while
                                        this.logger.debug(message_1.tooManyAttempts, attemptsCounter);
                                        throw new errors_1.ClientCancelled(new Error("Too many attempts: ".concat(attemptsCounter)));
                                    }
                                    r = void 0;
                                    _a.label = 2;
                                case 2:
                                    _a.trys.push([2, 4, , 5]);
                                    return [4 /*yield*/, fn(ctx, this.logger, attemptsCounter++)];
                                case 3:
                                    r = _a.sent();
                                    return [3 /*break*/, 5];
                                case 4:
                                    err_1 = _a.sent();
                                    r = { err: err_1 };
                                    return [3 /*break*/, 5];
                                case 5:
                                    if (!r.err) return [3 /*break*/, 11];
                                    retryPolicy = r.err[symbols_1.RetryPolicySymbol];
                                    if (!(retryPolicy && (r.idempotent ? retryPolicy.idempotent : retryPolicy.nonIdempotent))) return [3 /*break*/, 9];
                                    if (!(retryPolicy.backoff === 0 /* Backoff.No */)) return [3 /*break*/, 7];
                                    this.logger.debug(message_1.immediateBackoffRetryMessage, r.err, 1); // delay for 1 ms so fake timer can control process
                                    return [4 /*yield*/, utils.sleep(1)];
                                case 6:
                                    _a.sent();
                                    return [3 /*break*/, 1];
                                case 7:
                                    if (r.err.constructor === (prevError === null || prevError === void 0 ? void 0 : prevError.constructor)) { // same repeating Error slows down retries exponentially
                                        sameErrorCount++;
                                    }
                                    else {
                                        prevError = r.err;
                                        sameErrorCount = 0;
                                    }
                                    backoff = retryPolicy.backoff === 1 /* Backoff.Fast */
                                        ? this.retryParameters.fastBackoff
                                        : this.retryParameters.slowBackoff;
                                    waitFor = backoff.calcBackoffTimeout(sameErrorCount);
                                    this.logger.debug(retryPolicy.backoff === 1 /* Backoff.Fast */
                                        ? message_1.fastBackoffRetryMessage
                                        : message_1.slowBackoffRetryMessage, r.err, waitFor);
                                    return [4 /*yield*/, utils.sleep(waitFor)];
                                case 8:
                                    _a.sent();
                                    if (ctx.err) { // make sure that operation was not cancelled while awaiting retry time
                                        this.logger.debug(message_1.notRetryableErrorMessage, ctx.err);
                                        throw ctx.err;
                                    }
                                    return [3 /*break*/, 1];
                                case 9:
                                    this.logger.debug(message_1.notRetryableErrorMessage, r.err);
                                    _a.label = 10;
                                case 10: throw r.err;
                                case 11:
                                    this.logger.debug(message_1.successAfterNAttempts, attemptsCounter);
                                    return [2 /*return*/, r.result];
                                case 12: return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    };
    return RetryStrategy;
}());
exports.RetryStrategy = RetryStrategy;
