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
exports.TableSessionPool = exports.SessionEvent = exports.SessionBuilder = exports.TableService = void 0;
var ydb_sdk_proto_1 = require("ydb-sdk-proto");
exports.TableService = ydb_sdk_proto_1.Ydb.Table.V1.TableService;
var CreateSessionRequest = ydb_sdk_proto_1.Ydb.Table.CreateSessionRequest;
var CreateSessionResult = ydb_sdk_proto_1.Ydb.Table.CreateSessionResult;
var retries_obsoleted_1 = require("../retries_obsoleted");
var events_1 = require("events");
var constants_1 = require("../constants");
var lodash_1 = require("lodash");
var errors_1 = require("../errors");
var table_session_1 = require("./table-session");
var utils_1 = require("../utils");
var process_ydb_operation_result_1 = require("../utils/process-ydb-operation-result");
var utils_2 = require("../utils");
var context_1 = require("../context");
var SessionBuilder = function () {
    var _a;
    var _classSuper = utils_2.AuthenticatedService;
    var _instanceExtraInitializers = [];
    var _create_decorators;
    return _a = /** @class */ (function (_super) {
            __extends(SessionBuilder, _super);
            function SessionBuilder(endpoint, database, authService, logger, sslCredentials, clientOptions) {
                var _this = this;
                var host = endpoint.toString();
                _this = _super.call(this, host, database, 'Ydb.Table.V1.TableService', exports.TableService, authService, sslCredentials, clientOptions) || this;
                _this.endpoint = __runInitializers(_this, _instanceExtraInitializers);
                _this.endpoint = endpoint;
                _this.logger = logger;
                return _this;
            }
            SessionBuilder.prototype.create = function () {
                return __awaiter(this, void 0, void 0, function () {
                    var response, payload, sessionId;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, this.api.createSession(CreateSessionRequest.create())];
                            case 1:
                                response = _b.sent();
                                payload = (0, process_ydb_operation_result_1.getOperationPayload)(response);
                                sessionId = CreateSessionResult.decode(payload).sessionId;
                                return [2 /*return*/, new table_session_1.TableSession(this.api, this.endpoint, sessionId, this.logger, this.getResponseMetadata.bind(this))];
                        }
                    });
                });
            };
            return SessionBuilder;
        }(_classSuper)),
        (function () {
            var _b;
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_b = _classSuper[Symbol.metadata]) !== null && _b !== void 0 ? _b : null) : void 0;
            _create_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable];
            __esDecorate(_a, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: function (obj) { return "create" in obj; }, get: function (obj) { return obj.create; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.SessionBuilder = SessionBuilder;
var SessionEvent;
(function (SessionEvent) {
    SessionEvent["SESSION_RELEASE"] = "SESSION_RELEASE";
    SessionEvent["SESSION_BROKEN"] = "SESSION_BROKEN";
})(SessionEvent || (exports.SessionEvent = SessionEvent = {}));
var TableSessionPool = function () {
    var _a;
    var _classSuper = events_1.default;
    var _instanceExtraInitializers = [];
    var _destroy_decorators;
    var _withSession_decorators;
    var _withSessionRetry_decorators;
    return _a = /** @class */ (function (_super) {
            __extends(TableSessionPool, _super);
            function TableSessionPool(settings) {
                var _this = _super.call(this) || this;
                _this.database = __runInitializers(_this, _instanceExtraInitializers);
                _this.waiters = [];
                _this.database = settings.database;
                _this.authService = settings.authService;
                _this.sslCredentials = settings.sslCredentials;
                _this.clientOptions = settings.clientOptions;
                _this.logger = settings.logger;
                var poolSettings = settings.poolSettings;
                _this.minLimit = (poolSettings === null || poolSettings === void 0 ? void 0 : poolSettings.minLimit) || _a.SESSION_MIN_LIMIT;
                _this.maxLimit = (poolSettings === null || poolSettings === void 0 ? void 0 : poolSettings.maxLimit) || _a.SESSION_MAX_LIMIT;
                _this.sessions = new Set();
                _this.newSessionsRequested = 0;
                _this.sessionsBeingDeleted = 0;
                _this.sessionKeepAliveId = _this.initListeners((poolSettings === null || poolSettings === void 0 ? void 0 : poolSettings.keepAlivePeriod) || constants_1.SESSION_KEEPALIVE_PERIOD);
                _this.sessionBuilders = new Map();
                _this.discoveryService = settings.discoveryService;
                _this.discoveryService.on(constants_1.Events.ENDPOINT_REMOVED, function (endpoint) {
                    _this.sessionBuilders.delete(endpoint);
                });
                _this.prepopulateSessions();
                return _this;
            }
            TableSessionPool.prototype.destroy = function (_ctx) {
                return __awaiter(this, void 0, void 0, function () {
                    var _this = this;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                this.logger.debug('Destroying pool...');
                                clearInterval(this.sessionKeepAliveId);
                                return [4 /*yield*/, Promise.all(lodash_1.default.map(__spreadArray([], this.sessions, true), function (session) { return _this.deleteSession(session); }))];
                            case 1:
                                _b.sent();
                                this.logger.debug('Pool has been destroyed.');
                                return [2 /*return*/];
                        }
                    });
                });
            };
            TableSessionPool.prototype.initListeners = function (keepAlivePeriod) {
                var _this = this;
                return setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
                    var _this = this;
                    return __generator(this, function (_b) {
                        return [2 /*return*/, Promise.all(lodash_1.default.map(__spreadArray([], this.sessions, true), function (session) {
                                return session.keepAlive()
                                    // delete session if error
                                    .catch(function () { return _this.deleteSession(session); })
                                    // ignore errors to avoid UnhandledPromiseRejectionWarning
                                    .catch(function () { return Promise.resolve(); });
                            }))];
                    });
                }); }, keepAlivePeriod);
            };
            TableSessionPool.prototype.prepopulateSessions = function () {
                var _this = this;
                lodash_1.default.forEach(lodash_1.default.range(this.minLimit), function () { return _this.createSession(); });
            };
            TableSessionPool.prototype.getSessionBuilder = function () {
                return __awaiter(this, void 0, void 0, function () {
                    var endpoint, sessionService;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, this.discoveryService.getEndpoint()];
                            case 1:
                                endpoint = _b.sent();
                                if (!this.sessionBuilders.has(endpoint)) {
                                    sessionService = new SessionBuilder(endpoint, this.database, this.authService, this.logger, this.sslCredentials, this.clientOptions);
                                    this.sessionBuilders.set(endpoint, sessionService);
                                }
                                return [2 /*return*/, this.sessionBuilders.get(endpoint)];
                        }
                    });
                });
            };
            TableSessionPool.prototype.maybeUseSession = function (session) {
                if (this.waiters.length > 0) {
                    var waiter = this.waiters.shift();
                    if (typeof waiter === "function") {
                        waiter(session);
                        return true;
                    }
                }
                return false;
            };
            TableSessionPool.prototype.createSession = function () {
                return __awaiter(this, void 0, void 0, function () {
                    var sessionCreator, session;
                    var _this = this;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, this.getSessionBuilder()];
                            case 1:
                                sessionCreator = _b.sent();
                                return [4 /*yield*/, sessionCreator.create()];
                            case 2:
                                session = _b.sent();
                                session.on(SessionEvent.SESSION_RELEASE, function () { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0:
                                                if (!session.isClosing()) return [3 /*break*/, 2];
                                                return [4 /*yield*/, this.deleteSession(session)];
                                            case 1:
                                                _b.sent();
                                                return [3 /*break*/, 3];
                                            case 2:
                                                this.maybeUseSession(session);
                                                _b.label = 3;
                                            case 3: return [2 /*return*/];
                                        }
                                    });
                                }); });
                                session.on(SessionEvent.SESSION_BROKEN, function () { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0: return [4 /*yield*/, this.deleteSession(session)];
                                            case 1:
                                                _b.sent();
                                                return [2 /*return*/];
                                        }
                                    });
                                }); });
                                this.sessions.add(session);
                                return [2 /*return*/, session];
                        }
                    });
                });
            };
            TableSessionPool.prototype.deleteSession = function (session) {
                var _this = this;
                if (session.isDeleted()) {
                    return Promise.resolve();
                }
                this.sessionsBeingDeleted++;
                // acquire new session as soon one of existing ones is deleted
                if (this.waiters.length > 0) {
                    this.acquire().then(function (session) {
                        if (!_this.maybeUseSession(session)) {
                            session.release();
                        }
                    });
                }
                return session.delete()
                    // delete session in any case
                    .finally(function () {
                    _this.sessions.delete(session);
                    _this.sessionsBeingDeleted--;
                });
            };
            TableSessionPool.prototype.acquire = function (timeout) {
                var _this = this;
                if (timeout === void 0) { timeout = 0; }
                for (var _i = 0, _b = this.sessions; _i < _b.length; _i++) {
                    var session = _b[_i];
                    if (session.isFree()) {
                        return Promise.resolve(session.acquire());
                    }
                }
                if (this.sessions.size + this.newSessionsRequested - this.sessionsBeingDeleted <= this.maxLimit) {
                    this.newSessionsRequested++;
                    return this.createSession()
                        .then(function (session) {
                        return session.acquire();
                    })
                        .finally(function () {
                        _this.newSessionsRequested--;
                    });
                }
                else {
                    return new Promise(function (resolve, reject) {
                        var timeoutId;
                        function waiter(session) {
                            clearTimeout(timeoutId);
                            resolve(session.acquire());
                        }
                        if (timeout) {
                            timeoutId = setTimeout(function () {
                                _this.waiters.splice(_this.waiters.indexOf(waiter), 1);
                                reject(new errors_1.SessionPoolEmpty("No session became available within timeout of ".concat(timeout, " ms")));
                            }, timeout);
                        }
                        _this.waiters.push(waiter);
                    });
                }
            };
            TableSessionPool.prototype._withSession = function (_ctx_1, session_1, callback_1) {
                return __awaiter(this, arguments, void 0, function (_ctx, session, callback, maxRetries) {
                    var result, error_1;
                    if (maxRetries === void 0) { maxRetries = 0; }
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _a.trys.push([0, 2, , 6]);
                                return [4 /*yield*/, callback(session)];
                            case 1:
                                result = _a.sent();
                                session.release();
                                return [2 /*return*/, result];
                            case 2:
                                error_1 = _a.sent();
                                if (!(error_1 instanceof errors_1.BadSession || error_1 instanceof errors_1.SessionBusy)) return [3 /*break*/, 4];
                                this.logger.debug('Encountered bad or busy session, re-creating the session');
                                session.emit(SessionEvent.SESSION_BROKEN);
                                return [4 /*yield*/, this.createSession()];
                            case 3:
                                session = _a.sent();
                                if (maxRetries > 0) {
                                    this.logger.debug("Re-running operation in new session, ".concat(maxRetries, " left."));
                                    session.acquire();
                                    return [2 /*return*/, this._withSession(_ctx, session, callback, maxRetries - 1)];
                                }
                                return [3 /*break*/, 5];
                            case 4:
                                session.release();
                                _a.label = 5;
                            case 5: throw error_1;
                            case 6: return [2 /*return*/];
                        }
                    });
                });
            };
            TableSessionPool.prototype.withSession = function (ctx_1, callback_1) {
                return __awaiter(this, arguments, void 0, function (ctx, callback, timeout) {
                    var session;
                    if (timeout === void 0) { timeout = 0; }
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, this.acquire(timeout)];
                            case 1:
                                session = _a.sent();
                                return [2 /*return*/, this._withSession(ctx, session, callback)];
                        }
                    });
                });
            };
            TableSessionPool.prototype.withSessionRetry = function (ctx_1, callback_1) {
                return __awaiter(this, arguments, void 0, function (ctx, callback, timeout, maxRetries) {
                    var session;
                    if (timeout === void 0) { timeout = 0; }
                    if (maxRetries === void 0) { maxRetries = 10; }
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, this.acquire(timeout)];
                            case 1:
                                session = _a.sent();
                                return [2 /*return*/, this._withSession(ctx, session, callback, maxRetries)];
                        }
                    });
                });
            };
            return TableSessionPool;
        }(_classSuper)),
        (function () {
            var _b;
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_b = _classSuper[Symbol.metadata]) !== null && _b !== void 0 ? _b : null) : void 0;
            _destroy_decorators = [(0, context_1.ensureContext)(true)];
            _withSession_decorators = [(0, context_1.ensureContext)(true)];
            _withSessionRetry_decorators = [(0, context_1.ensureContext)(true)];
            __esDecorate(_a, null, _destroy_decorators, { kind: "method", name: "destroy", static: false, private: false, access: { has: function (obj) { return "destroy" in obj; }, get: function (obj) { return obj.destroy; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _withSession_decorators, { kind: "method", name: "withSession", static: false, private: false, access: { has: function (obj) { return "withSession" in obj; }, get: function (obj) { return obj.withSession; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _withSessionRetry_decorators, { kind: "method", name: "withSessionRetry", static: false, private: false, access: { has: function (obj) { return "withSessionRetry" in obj; }, get: function (obj) { return obj.withSessionRetry; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a.SESSION_MIN_LIMIT = 1 // TODO: Return back to 5
    ,
        _a.SESSION_MAX_LIMIT = 20,
        _a;
}();
exports.TableSessionPool = TableSessionPool;
