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
exports.QuerySession = exports.attachStreamSymbol = exports.implSymbol = exports.apiSymbol = void 0;
var events_1 = require("events");
var query_session_pool_1 = require("./query-session-pool");
var retries_obsoleted_1 = require("../retries_obsoleted");
var utils_1 = require("../utils");
var process_ydb_operation_result_1 = require("../utils/process-ydb-operation-result");
var symbols_1 = require("./symbols");
var query_session_attach_1 = require("./query-session-attach");
var query_session_execute_1 = require("./query-session-execute");
var query_session_transaction_1 = require("./query-session-transaction");
exports.apiSymbol = Symbol('api');
exports.implSymbol = Symbol('impl');
exports.attachStreamSymbol = Symbol('attachStream');
var QuerySession = function () {
    var _a, _b, _c, _d, _e;
    var _classSuper = events_1.default;
    var _instanceExtraInitializers = [];
    var _delete_decorators;
    return _a = /** @class */ (function (_super) {
            __extends(QuerySession, _super);
            function QuerySession(// TODO: Change to named parameters for consistency
            _api, _impl, endpoint, sessionId, logger) {
                var _this = _super.call(this) || this;
                _this.endpoint = (__runInitializers(_this, _instanceExtraInitializers), endpoint);
                _this.logger = logger;
                // TODO: Move those fields to SessionBase
                _this.beingDeleted = false;
                _this.free = true;
                _this.closing = false;
                // TODO: Uncomment after switch to TS 5.3
                // [Symbol.asyncDispose]() {
                //     return this.delete();
                // }
                _this[_b] = query_session_attach_1.attach;
                _this[_c] = query_session_transaction_1.beginTransaction;
                _this[_d] = query_session_transaction_1.commitTransaction;
                _this[_e] = query_session_transaction_1.rollbackTransaction;
                _this.execute = query_session_execute_1.execute;
                _this[exports.apiSymbol] = _api;
                _this[exports.implSymbol] = _impl;
                _this[symbols_1.sessionIdSymbol] = sessionId;
                return _this;
            }
            Object.defineProperty(QuerySession.prototype, "ctx", {
                get: function () {
                    return this[symbols_1.ctxSymbol];
                },
                enumerable: false,
                configurable: true
            });
            Object.defineProperty(QuerySession.prototype, "sessionId", {
                get: function () {
                    return this[symbols_1.sessionIdSymbol];
                },
                enumerable: false,
                configurable: true
            });
            Object.defineProperty(QuerySession.prototype, "txId", {
                get: function () {
                    return this[symbols_1.sessionTxIdSymbol];
                },
                enumerable: false,
                configurable: true
            });
            QuerySession[symbols_1.createSymbol] = function (api, impl, endpoint, sessionId, logger) {
                return new _a(api, impl, endpoint, sessionId, logger);
            };
            QuerySession.prototype[symbols_1.sessionAcquireSymbol] = function () {
                this.free = false;
                this.logger.debug("Acquired session ".concat(this.sessionId, " on endpoint ").concat(this.endpoint.toString(), "."));
                return this;
            };
            QuerySession.prototype[symbols_1.sessionReleaseSymbol] = function () {
                if (this[symbols_1.sessionCurrentOperationSymbol])
                    throw new Error('There is an active operation');
                this.free = true;
                this.logger.debug("Released session ".concat(this.sessionId, " on endpoint ").concat(this.endpoint.toString(), "."));
                this.emit(query_session_pool_1.SessionEvent.SESSION_RELEASE, this);
            };
            QuerySession.prototype[symbols_1.sessionIsFreeSymbol] = function () {
                return this.free && !this[symbols_1.sessionIsDeletedSymbol]();
            };
            QuerySession.prototype[symbols_1.sessionIsClosingSymbol] = function () {
                return this.closing;
            };
            QuerySession.prototype[symbols_1.sessionDeleteOnReleaseSymbol] = function () {
                this.closing = true;
            };
            QuerySession.prototype[symbols_1.sessionIsDeletedSymbol] = function () {
                return this.beingDeleted;
            };
            QuerySession.prototype.delete = function () {
                return __awaiter(this, void 0, void 0, function () {
                    var _f;
                    var _g;
                    return __generator(this, function (_h) {
                        switch (_h.label) {
                            case 0:
                                if (this[symbols_1.sessionIsDeletedSymbol]())
                                    return [2 /*return*/];
                                this.beingDeleted = true;
                                return [4 /*yield*/, ((_g = this[exports.attachStreamSymbol]) === null || _g === void 0 ? void 0 : _g.cancel())];
                            case 1:
                                _h.sent();
                                delete this[exports.attachStreamSymbol]; // only one stream cancel even when multi ple retries
                                _f = process_ydb_operation_result_1.ensureCallSucceeded;
                                return [4 /*yield*/, this[exports.apiSymbol].deleteSession({ sessionId: this.sessionId })];
                            case 2:
                                _f.apply(void 0, [_h.sent()]);
                                return [2 /*return*/];
                        }
                    });
                });
            };
            QuerySession.prototype.beginTransaction = function () {
                return __awaiter(this, arguments, void 0, function (txSettings) {
                    if (txSettings === void 0) { txSettings = null; }
                    return __generator(this, function (_f) {
                        if (this[symbols_1.sessionTxSettingsSymbol])
                            throw new Error(query_session_execute_1.CANNOT_MANAGE_TRASACTIONS_ERROR);
                        return [2 /*return*/, query_session_transaction_1.beginTransaction.call(this, txSettings)];
                    });
                });
            };
            QuerySession.prototype.commitTransaction = function () {
                return __awaiter(this, void 0, void 0, function () {
                    return __generator(this, function (_f) {
                        if (this[symbols_1.sessionTxSettingsSymbol])
                            throw new Error(query_session_execute_1.CANNOT_MANAGE_TRASACTIONS_ERROR);
                        return [2 /*return*/, query_session_transaction_1.commitTransaction.call(this)];
                    });
                });
            };
            QuerySession.prototype.rollbackTransaction = function () {
                return __awaiter(this, void 0, void 0, function () {
                    return __generator(this, function (_f) {
                        if (this[symbols_1.sessionTxSettingsSymbol])
                            throw new Error(query_session_execute_1.CANNOT_MANAGE_TRASACTIONS_ERROR);
                        return [2 /*return*/, query_session_transaction_1.rollbackTransaction.call(this)];
                    });
                });
            };
            return QuerySession;
        }(_classSuper)),
        _b = (_delete_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable], symbols_1.sessionAttachSymbol),
        _c = symbols_1.sessionBeginTransactionSymbol,
        _d = symbols_1.sessionCommitTransactionSymbol,
        _e = symbols_1.sessionRollbackTransactionSymbol,
        (function () {
            var _f;
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_f = _classSuper[Symbol.metadata]) !== null && _f !== void 0 ? _f : null) : void 0;
            __esDecorate(_a, null, _delete_decorators, { kind: "method", name: "delete", static: false, private: false, access: { has: function (obj) { return "delete" in obj; }, get: function (obj) { return obj.delete; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.QuerySession = QuerySession;
