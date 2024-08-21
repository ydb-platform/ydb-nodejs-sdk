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
exports.QuerySessionPool = exports.SessionEvent = exports.SessionBuilder = exports.QueryService = void 0;
var ydb_sdk_proto_1 = require("ydb-sdk-proto");
exports.QueryService = ydb_sdk_proto_1.Ydb.Query.V1.QueryService;
var CreateSessionRequest = ydb_sdk_proto_1.Ydb.Query.CreateSessionRequest;
var retries_obsoleted_1 = require("../retries_obsoleted");
var events_1 = require("events");
var constants_1 = require("../constants");
var lodash_1 = require("lodash");
var errors_1 = require("../errors");
var query_session_1 = require("./query-session");
var utils_1 = require("../utils");
var process_ydb_operation_result_1 = require("../utils/process-ydb-operation-result");
var utils_2 = require("../utils");
var symbols_1 = require("./symbols");
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
                _this = _super.call(this, host, database, 'Ydb.Query.V1.QueryService', exports.QueryService, authService, sslCredentials, clientOptions, ['AttachSession', 'ExecuteQuery'] // methods that return Stream
                ) || this;
                _this.endpoint = __runInitializers(_this, _instanceExtraInitializers);
                _this.endpoint = endpoint;
                _this.logger = logger;
                return _this;
            }
            SessionBuilder.prototype.create = function () {
                return __awaiter(this, void 0, void 0, function () {
                    var sessionId, _b, session;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _b = process_ydb_operation_result_1.ensureCallSucceeded;
                                return [4 /*yield*/, this.api.createSession(CreateSessionRequest.create())];
                            case 1:
                                sessionId = _b.apply(void 0, [_c.sent()]).sessionId;
                                session = query_session_1.QuerySession[symbols_1.createSymbol](this.api, this, this.endpoint, sessionId, this.logger /*, this.getResponseMetadata.bind(this)*/);
                                return [4 /*yield*/, session[symbols_1.sessionAttachSymbol](function () {
                                        session[symbols_1.sessionDeleteOnReleaseSymbol]();
                                    })];
                            case 2:
                                _c.sent();
                                return [2 /*return*/, session];
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
var QuerySessionPool = /** @class */ (function (_super) {
    __extends(QuerySessionPool, _super);
    function QuerySessionPool(settings) {
        var _this = _super.call(this) || this;
        _this.waiters = [];
        _this.database = settings.database;
        _this.authService = settings.authService;
        _this.sslCredentials = settings.sslCredentials;
        _this.clientOptions = settings.clientOptions;
        _this.logger = settings.logger;
        var poolSettings = settings.poolSettings;
        _this.minLimit = (poolSettings === null || poolSettings === void 0 ? void 0 : poolSettings.minLimit) || QuerySessionPool.SESSION_MIN_LIMIT;
        _this.maxLimit = (poolSettings === null || poolSettings === void 0 ? void 0 : poolSettings.maxLimit) || QuerySessionPool.SESSION_MAX_LIMIT;
        _this.sessions = new Set();
        _this.newSessionsRequested = 0;
        _this.sessionsBeingDeleted = 0;
        _this.sessionBuilders = new Map();
        _this.discoveryService = settings.discoveryService;
        _this.discoveryService.on(constants_1.Events.ENDPOINT_REMOVED, function (endpoint) {
            _this.sessionBuilders.delete(endpoint);
        });
        return _this;
        // this.prepopulateSessions();
    }
    QuerySessionPool.prototype.destroy = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.logger.debug('Destroying query pool...');
                        return [4 /*yield*/, Promise.all(lodash_1.default.map(__spreadArray([], this.sessions, true), function (session) { return _this.deleteSession(session); }))];
                    case 1:
                        _a.sent();
                        this.logger.debug('Query pool has been destroyed.');
                        return [2 /*return*/];
                }
            });
        });
    };
    // TODO: Uncomment after switch to TS 5.3
    // [Symbol.asyncDispose]() {
    //     return this.destroy();
    // }
    // TODO: Reconsider. Seems like bad idea for serverless functions and causes problems on quick dispose
    // private prepopulateSessions() {
    //     _.forEach(_.range(this.minLimit), () => this.createSession());
    // }
    QuerySessionPool.prototype.getSessionBuilder = function () {
        return __awaiter(this, void 0, void 0, function () {
            var endpoint, sessionService;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.discoveryService.getEndpoint()];
                    case 1:
                        endpoint = _a.sent();
                        if (!this.sessionBuilders.has(endpoint)) {
                            sessionService = new SessionBuilder(endpoint, this.database, this.authService, this.logger, this.sslCredentials, this.clientOptions);
                            this.sessionBuilders.set(endpoint, sessionService);
                        }
                        return [2 /*return*/, this.sessionBuilders.get(endpoint)];
                }
            });
        });
    };
    QuerySessionPool.prototype.maybeUseSession = function (session) {
        if (this.waiters.length > 0) {
            var waiter = this.waiters.shift();
            if (typeof waiter === "function") {
                waiter(session);
                return true;
            }
        }
        return false;
    };
    QuerySessionPool.prototype.createSession = function () {
        return __awaiter(this, void 0, void 0, function () {
            var sessionCreator, session;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getSessionBuilder()];
                    case 1:
                        sessionCreator = _a.sent();
                        return [4 /*yield*/, sessionCreator.create()];
                    case 2:
                        session = _a.sent();
                        session.on(SessionEvent.SESSION_RELEASE, function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!session[symbols_1.sessionIsClosingSymbol]()) return [3 /*break*/, 2];
                                        return [4 /*yield*/, this.deleteSession(session)];
                                    case 1:
                                        _a.sent();
                                        return [3 /*break*/, 3];
                                    case 2:
                                        this.maybeUseSession(session);
                                        _a.label = 3;
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                        session.on(SessionEvent.SESSION_BROKEN, function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, this.deleteSession(session)];
                                    case 1:
                                        _a.sent();
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
    QuerySessionPool.prototype.deleteSession = function (session) {
        var _this = this;
        if (session[symbols_1.sessionIsDeletedSymbol]()) {
            return Promise.resolve();
        }
        this.sessionsBeingDeleted++;
        // acquire new session as soon one of existing ones is deleted
        if (this.waiters.length > 0) {
            this.acquire().then(function (session) {
                if (!_this.maybeUseSession(session)) {
                    session[symbols_1.sessionReleaseSymbol]();
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
    QuerySessionPool.prototype.acquire = function (timeout) {
        var _this = this;
        if (timeout === void 0) { timeout = 0; }
        for (var _i = 0, _a = this.sessions; _i < _a.length; _i++) {
            var session = _a[_i];
            if (session[symbols_1.sessionIsFreeSymbol]()) {
                return Promise.resolve(session[symbols_1.sessionAcquireSymbol]());
            }
        }
        if (this.sessions.size + this.newSessionsRequested - this.sessionsBeingDeleted <= this.maxLimit) {
            this.newSessionsRequested++;
            return this.createSession()
                .then(function (session) {
                return session[symbols_1.sessionAcquireSymbol]();
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
                    resolve(session[symbols_1.sessionAcquireSymbol]());
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
    QuerySessionPool.SESSION_MIN_LIMIT = 5;
    QuerySessionPool.SESSION_MAX_LIMIT = 20;
    return QuerySessionPool;
}(events_1.default));
exports.QuerySessionPool = QuerySessionPool;
