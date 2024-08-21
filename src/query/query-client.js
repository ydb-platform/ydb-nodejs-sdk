"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
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
exports.QueryClient = void 0;
var events_1 = require("events");
var query_session_pool_1 = require("./query-session-pool");
var table_1 = require("../table");
var symbols_1 = require("./symbols");
var errors_1 = require("../errors");
var context_1 = require("../context");
var retryStrategy_1 = require("../retries/retryStrategy");
var retryParameters_1 = require("../retries/retryParameters");
var symbols_2 = require("../retries/symbols");
/**
 * YDB Query Service client.
 *
 * # Experimental
 *
 * Notice: This API is EXPERIMENTAL and may be changed or removed in a later release.
 */
var QueryClient = function () {
    var _a;
    var _classSuper = events_1.default;
    var _instanceExtraInitializers = [];
    var _do_decorators;
    var _doTx_decorators;
    return _a = /** @class */ (function (_super) {
            __extends(QueryClient, _super);
            function QueryClient(settings) {
                var _this = _super.call(this) || this;
                _this.pool = __runInitializers(_this, _instanceExtraInitializers);
                _this.logger = settings.logger;
                _this.pool = new query_session_pool_1.QuerySessionPool(settings);
                _this.retrier = new retryStrategy_1.RetryStrategy(new retryParameters_1.RetryParameters({ maxRetries: 0 }), _this.logger);
                return _this;
            }
            QueryClient.prototype.destroy = function () {
                return __awaiter(this, void 0, void 0, function () {
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, this.pool.destroy()];
                            case 1:
                                _b.sent();
                                return [2 /*return*/];
                        }
                    });
                });
            };
            QueryClient.prototype.do = function (opts) {
                return __awaiter(this, void 0, void 0, function () {
                    var _this = this;
                    return __generator(this, function (_b) {
                        return [2 /*return*/, opts.ctx.wrap({
                                timeout: opts.timeout
                            }, function (ctx) { return __awaiter(_this, void 0, void 0, function () {
                                var _this = this;
                                return __generator(this, function (_b) {
                                    return [2 /*return*/, this.retrier.retry(ctx, function (_ctx) { return __awaiter(_this, void 0, void 0, function () {
                                            var session, error, res, err_1, err_2;
                                            var _b;
                                            return __generator(this, function (_c) {
                                                switch (_c.label) {
                                                    case 0: return [4 /*yield*/, this.pool.acquire()];
                                                    case 1:
                                                        session = _c.sent();
                                                        session[symbols_1.ctxSymbol] = ctx;
                                                        if (opts.hasOwnProperty('idempotent')) {
                                                            session[symbols_1.isIdempotentDoLevelSymbol] = true;
                                                            session[symbols_1.isIdempotentSymbol] = opts.idempotent;
                                                        }
                                                        _c.label = 2;
                                                    case 2:
                                                        _c.trys.push([2, 13, 14, 15]);
                                                        if (opts.txSettings)
                                                            session[symbols_1.sessionTxSettingsSymbol] = opts.txSettings;
                                                        res = void 0;
                                                        _c.label = 3;
                                                    case 3:
                                                        _c.trys.push([3, 5, , 8]);
                                                        return [4 /*yield*/, opts.fn(session)];
                                                    case 4:
                                                        res = _c.sent();
                                                        return [3 /*break*/, 8];
                                                    case 5:
                                                        err_1 = _c.sent();
                                                        if (!(session[symbols_1.sessionTxIdSymbol] && !(err_1 instanceof errors_1.BadSession || err_1 instanceof errors_1.SessionBusy))) return [3 /*break*/, 7];
                                                        return [4 /*yield*/, session[symbols_1.sessionRollbackTransactionSymbol]()];
                                                    case 6:
                                                        _c.sent();
                                                        _c.label = 7;
                                                    case 7: throw err_1;
                                                    case 8:
                                                        if (!session[symbols_1.sessionTxIdSymbol]) return [3 /*break*/, 12];
                                                        if (!opts.txSettings) return [3 /*break*/, 10];
                                                        // likely doTx was called and user expects have the transaction being commited
                                                        return [4 /*yield*/, session[symbols_1.sessionCommitTransactionSymbol]()];
                                                    case 9:
                                                        // likely doTx was called and user expects have the transaction being commited
                                                        _c.sent();
                                                        return [3 /*break*/, 12];
                                                    case 10: 
                                                    // likely do() was called and user intentionally haven't closed transaction
                                                    return [4 /*yield*/, session[symbols_1.sessionRollbackTransactionSymbol]()];
                                                    case 11:
                                                        // likely do() was called and user intentionally haven't closed transaction
                                                        _c.sent();
                                                        _c.label = 12;
                                                    case 12: return [2 /*return*/, { result: res }];
                                                    case 13:
                                                        err_2 = _c.sent();
                                                        error = err_2;
                                                        return [2 /*return*/, { err: error, idempotent: session[symbols_1.isIdempotentSymbol] }];
                                                    case 14:
                                                        delete session[symbols_1.ctxSymbol];
                                                        delete session[symbols_1.sessionTxSettingsSymbol];
                                                        delete session[symbols_1.sessionCurrentOperationSymbol];
                                                        delete session[symbols_1.isIdempotentDoLevelSymbol];
                                                        delete session[symbols_1.isIdempotentSymbol];
                                                        // @ts-ignore
                                                        if (error && ((_b = error[symbols_2.RetryPolicySymbol]) === null || _b === void 0 ? void 0 : _b.deleteSession)) {
                                                            this.logger.debug('Encountered bad or busy session, re-creating the session');
                                                            session.emit(query_session_pool_1.SessionEvent.SESSION_BROKEN);
                                                        }
                                                        else {
                                                            session[symbols_1.sessionReleaseSymbol]();
                                                        }
                                                        return [7 /*endfinally*/];
                                                    case 15: return [2 /*return*/];
                                                }
                                            });
                                        }); })];
                                });
                            }); })];
                    });
                });
            };
            QueryClient.prototype.doTx = function (opts) {
                if (!opts.txSettings) {
                    opts = __assign(__assign({}, opts), { txSettings: table_1.AUTO_TX.beginTx });
                }
                return this.do(opts);
            };
            return QueryClient;
        }(_classSuper)),
        (function () {
            var _b;
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_b = _classSuper[Symbol.metadata]) !== null && _b !== void 0 ? _b : null) : void 0;
            _do_decorators = [(0, context_1.ensureContext)()];
            _doTx_decorators = [(0, context_1.ensureContext)()];
            __esDecorate(_a, null, _do_decorators, { kind: "method", name: "do", static: false, private: false, access: { has: function (obj) { return "do" in obj; }, get: function (obj) { return obj.do; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _doTx_decorators, { kind: "method", name: "doTx", static: false, private: false, access: { has: function (obj) { return "doTx" in obj; }, get: function (obj) { return obj.doTx; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.QueryClient = QueryClient;
