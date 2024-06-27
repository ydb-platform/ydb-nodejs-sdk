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
var ydb_sdk_proto_1 = require("ydb-sdk-proto");
var DiscoveryServiceAPI = ydb_sdk_proto_1.Ydb.Discovery.V1.DiscoveryService;
var endpoint_1 = require("./endpoint");
var events_1 = require("events");
var lodash_1 = require("lodash");
var constants_1 = require("../constants");
var retries_obsoleted_1 = require("../retries_obsoleted");
var process_ydb_operation_result_1 = require("../utils/process-ydb-operation-result");
var utils_1 = require("../utils");
var noOp = function () {
};
var DiscoveryService = function () {
    var _a;
    var _classSuper = utils_1.AuthenticatedService;
    var _instanceExtraInitializers = [];
    var _discoverEndpoints_decorators;
    return _a = /** @class */ (function (_super) {
            __extends(DiscoveryService, _super);
            // private selfLocation: string = '';
            function DiscoveryService(settings) {
                var _this = _super.call(this, settings.endpoint, settings.database, 'Ydb.Discovery.V1.DiscoveryService', DiscoveryServiceAPI, settings.authService, settings.sslCredentials) || this;
                _this.database = __runInitializers(_this, _instanceExtraInitializers);
                _this.resolveEndpoints = noOp;
                _this.rejectEndpoints = noOp;
                _this.endpoints = [];
                _this.currentEndpointIndex = 0;
                _this.events = new events_1.default();
                _this.database = settings.database;
                _this.discoveryPeriod = settings.discoveryPeriod;
                _this.logger = settings.logger;
                _this.endpointsPromise = new Promise(function (resolve, reject) {
                    _this.resolveEndpoints = function (endpoints) {
                        _this.updateEndpoints(endpoints);
                        resolve();
                    };
                    _this.rejectEndpoints = reject;
                });
                _this.periodicDiscoveryId = _this.init();
                return _this;
            }
            DiscoveryService.prototype.destroy = function () {
                clearInterval(this.periodicDiscoveryId);
            };
            DiscoveryService.prototype.init = function () {
                var _this = this;
                this.discoverEndpoints(this.database)
                    .then(this.resolveEndpoints)
                    .catch(this.rejectEndpoints);
                return setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
                    var endpoints, error_1;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, this.endpointsPromise];
                            case 1:
                                _b.sent();
                                _b.label = 2;
                            case 2:
                                _b.trys.push([2, 4, , 5]);
                                return [4 /*yield*/, this.discoverEndpoints(this.database)];
                            case 3:
                                endpoints = _b.sent();
                                this.updateEndpoints(endpoints);
                                return [3 /*break*/, 5];
                            case 4:
                                error_1 = _b.sent();
                                this.logger.error(error_1);
                                return [3 /*break*/, 5];
                            case 5: return [2 /*return*/];
                        }
                    });
                }); }, this.discoveryPeriod);
            };
            DiscoveryService.prototype.updateEndpoints = function (endpoints) {
                var _this = this;
                var getHost = function (endpoint) { return endpoint.toString(); };
                var endpointsToAdd = lodash_1.default.differenceBy(endpoints, this.endpoints, getHost);
                var endpointsToRemove = lodash_1.default.differenceBy(this.endpoints, endpoints, getHost);
                var endpointsToUpdate = lodash_1.default.intersectionBy(this.endpoints, endpoints, getHost);
                this.logger.trace('Current endpoints %o', this.endpoints);
                this.logger.trace('Incoming endpoints %o', endpoints);
                this.logger.trace('Endpoints to add %o', endpointsToAdd);
                this.logger.trace('Endpoints to remove %o', endpointsToRemove);
                this.logger.trace('Endpoints to update %o', endpointsToUpdate);
                lodash_1.default.forEach(endpointsToRemove, function (endpoint) { return _this.emit(constants_1.Events.ENDPOINT_REMOVED, endpoint); });
                var _loop_1 = function (current) {
                    var newEndpoint = lodash_1.default.find(endpoints, function (incoming) { return incoming.toString() === current.toString(); });
                    current.update(newEndpoint);
                };
                for (var _i = 0, endpointsToUpdate_1 = endpointsToUpdate; _i < endpointsToUpdate_1.length; _i++) {
                    var current = endpointsToUpdate_1[_i];
                    _loop_1(current);
                }
                // endpointsToUpdate ordering is the same as this.endpoints, according to _.intersectionBy docs
                this.endpoints = endpointsToUpdate.concat(endpointsToAdd);
                // reset round-robin index in case new endpoints have been discovered or existing ones have become stale
                if (endpointsToRemove.length + endpointsToAdd.length > 0) {
                    this.endpoints = lodash_1.default.shuffle(this.endpoints);
                    this.currentEndpointIndex = 0;
                }
            };
            DiscoveryService.prototype.discoverEndpoints = function (database) {
                return __awaiter(this, void 0, void 0, function () {
                    var response, payload, endpointsResult;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, this.api.listEndpoints({ database: database })];
                            case 1:
                                response = _b.sent();
                                payload = (0, process_ydb_operation_result_1.getOperationPayload)(response);
                                endpointsResult = ydb_sdk_proto_1.Ydb.Discovery.ListEndpointsResult.decode(payload);
                                // this.selfLocation = endpointsResult.selfLocation;
                                return [2 /*return*/, lodash_1.default.map(endpointsResult.endpoints, function (endpointInfo) { return new endpoint_1.Endpoint(endpointInfo, database); })];
                        }
                    });
                });
            };
            DiscoveryService.prototype.emit = function (eventName) {
                var _b;
                var args = [];
                for (var _i = 1; _i < arguments.length; _i++) {
                    args[_i - 1] = arguments[_i];
                }
                (_b = this.events).emit.apply(_b, __spreadArray([eventName], args, false));
            };
            DiscoveryService.prototype.on = function (eventName, callback) {
                this.events.on(eventName, callback);
            };
            DiscoveryService.prototype.ready = function (timeout) {
                return (0, utils_1.withTimeout)(this.endpointsPromise, timeout);
            };
            DiscoveryService.prototype.getEndpointRR = function () {
                return __awaiter(this, void 0, void 0, function () {
                    var endpoint;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, this.endpointsPromise];
                            case 1:
                                _b.sent();
                                endpoint = this.endpoints[this.currentEndpointIndex++ % this.endpoints.length];
                                this.logger.trace('getEndpointRR result: %o', endpoint);
                                return [2 /*return*/, endpoint];
                        }
                    });
                });
            };
            DiscoveryService.prototype.getEndpoint = function () {
                return __awaiter(this, void 0, void 0, function () {
                    var endpoint, counter;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, this.getEndpointRR()];
                            case 1:
                                endpoint = _b.sent();
                                counter = 0;
                                _b.label = 2;
                            case 2:
                                if (!(endpoint.pessimized && counter < this.endpoints.length)) return [3 /*break*/, 4];
                                return [4 /*yield*/, this.getEndpointRR()];
                            case 3:
                                endpoint = _b.sent();
                                counter++;
                                return [3 /*break*/, 2];
                            case 4:
                                if (counter === this.endpoints.length) {
                                    this.logger.debug('All endpoints are pessimized, returning original endpoint');
                                }
                                return [2 /*return*/, endpoint];
                        }
                    });
                });
            };
            return DiscoveryService;
        }(_classSuper)),
        (function () {
            var _b;
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_b = _classSuper[Symbol.metadata]) !== null && _b !== void 0 ? _b : null) : void 0;
            _discoverEndpoints_decorators = [(0, retries_obsoleted_1.retryable)()];
            __esDecorate(_a, null, _discoverEndpoints_decorators, { kind: "method", name: "discoverEndpoints", static: false, private: false, access: { has: function (obj) { return "discoverEndpoints" in obj; }, get: function (obj) { return obj.discoverEndpoints; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.default = DiscoveryService;
