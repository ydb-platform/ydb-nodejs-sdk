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
exports.IamAuthService = void 0;
var luxon_1 = require("luxon");
var ydb_sdk_proto_1 = require("ydb-sdk-proto");
var jsonwebtoken_1 = require("jsonwebtoken");
var utils_1 = require("../utils");
var retries_obsoleted_1 = require("../retries_obsoleted");
var IamTokenService = ydb_sdk_proto_1.yandex.cloud.iam.v1.IamTokenService;
var add_credentials_to_metadata_1 = require("./add-credentials-to-metadata");
var ssl_credentials_1 = require("../utils/ssl-credentials");
var get_default_logger_1 = require("../logger/get-default-logger");
var context_1 = require("../context");
var IamTokenGrpcService = function () {
    var _a;
    var _classSuper = utils_1.GrpcService;
    var _instanceExtraInitializers = [];
    var _create_decorators;
    return _a = /** @class */ (function (_super) {
            __extends(IamTokenGrpcService, _super);
            function IamTokenGrpcService(iamCredentials, sslCredentialsOrLogger, logger) {
                var _this = this;
                var hasLogger = typeof sslCredentialsOrLogger === 'object' && sslCredentialsOrLogger !== null && 'error' in sslCredentialsOrLogger;
                _this = _super.call(this, iamCredentials.iamEndpoint, 'yandex.cloud.iam.v1.IamTokenService', IamTokenService, (sslCredentialsOrLogger && !hasLogger) ? sslCredentialsOrLogger : undefined) || this;
                _this.logger = __runInitializers(_this, _instanceExtraInitializers);
                if (hasLogger) {
                    _this.logger = sslCredentialsOrLogger;
                }
                else {
                    _this.logger = logger !== null && logger !== void 0 ? logger : (0, get_default_logger_1.getDefaultLogger)();
                }
                return _this;
            }
            IamTokenGrpcService.prototype.create = function (request) {
                return this.api.create(request);
            };
            IamTokenGrpcService.prototype.destroy = function () {
                this.api.end();
            };
            return IamTokenGrpcService;
        }(_classSuper)),
        (function () {
            var _b;
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_b = _classSuper[Symbol.metadata]) !== null && _b !== void 0 ? _b : null) : void 0;
            _create_decorators = [(0, context_1.ensureContext)(true), (0, retries_obsoleted_1.retryable)()];
            __esDecorate(_a, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: function (obj) { return "create" in obj; }, get: function (obj) { return obj.create; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
var IamAuthService = /** @class */ (function () {
    function IamAuthService(iamCredentials, sslCredentialsOrLogger, logger) {
        this.jwtExpirationTimeout = 3600 * 1000;
        this.tokenExpirationTimeout = 120 * 1000;
        this.tokenRequestTimeout = 10 * 1000;
        this.token = '';
        this.tokenUpdateInProgress = false;
        this.iamCredentials = iamCredentials;
        this.tokenTimestamp = null;
        if (typeof sslCredentialsOrLogger === 'object' && sslCredentialsOrLogger !== null && 'error' in sslCredentialsOrLogger) {
            this.sslCredentials = (0, ssl_credentials_1.makeDefaultSslCredentials)();
            this.logger = sslCredentialsOrLogger;
        }
        else {
            this.sslCredentials = sslCredentialsOrLogger || (0, ssl_credentials_1.makeDefaultSslCredentials)();
            this.logger = logger !== null && logger !== void 0 ? logger : (0, get_default_logger_1.getDefaultLogger)();
        }
    }
    IamAuthService.prototype.getJwtRequest = function () {
        var now = luxon_1.DateTime.utc();
        var expires = now.plus({ milliseconds: this.jwtExpirationTimeout });
        var payload = {
            "iss": this.iamCredentials.serviceAccountId,
            "aud": "https://iam.api.cloud.yandex.net/iam/v1/tokens",
            "iat": Math.round(now.toSeconds()),
            "exp": Math.round(expires.toSeconds())
        };
        var options = {
            algorithm: "PS256",
            keyid: this.iamCredentials.accessKeyId
        };
        return jsonwebtoken_1.default.sign(payload, this.iamCredentials.privateKey, options);
    };
    Object.defineProperty(IamAuthService.prototype, "expired", {
        get: function () {
            return !this.tokenTimestamp || (luxon_1.DateTime.utc().diff(this.tokenTimestamp).valueOf() > this.tokenExpirationTimeout);
        },
        enumerable: false,
        configurable: true
    });
    IamAuthService.prototype.sendTokenRequest = function () {
        return __awaiter(this, void 0, void 0, function () {
            var runtimeIamAuthService, tokenPromise, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        runtimeIamAuthService = new IamTokenGrpcService(this.iamCredentials, this.sslCredentials, this.logger);
                        tokenPromise = runtimeIamAuthService.create({ jwt: this.getJwtRequest() });
                        return [4 /*yield*/, (0, utils_1.withTimeout)(tokenPromise, this.tokenRequestTimeout)];
                    case 1:
                        result = _a.sent();
                        runtimeIamAuthService.destroy();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    IamAuthService.prototype.updateToken = function () {
        return __awaiter(this, void 0, void 0, function () {
            var iamToken;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.tokenUpdateInProgress = true;
                        return [4 /*yield*/, this.sendTokenRequest()];
                    case 1:
                        iamToken = (_a.sent()).iamToken;
                        if (iamToken) {
                            this.token = iamToken;
                            this.tokenTimestamp = luxon_1.DateTime.utc();
                            this.tokenUpdateInProgress = false;
                        }
                        else {
                            this.tokenUpdateInProgress = false;
                            throw new Error('Received empty token from IAM!');
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    IamAuthService.prototype.waitUntilTokenUpdated = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.tokenUpdateInProgress) return [3 /*break*/, 2];
                        return [4 /*yield*/, (0, utils_1.sleep)(1)];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 0];
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    IamAuthService.prototype.getAuthMetadata = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.expired) return [3 /*break*/, 4];
                        if (!this.tokenUpdateInProgress) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.waitUntilTokenUpdated()];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, this.updateToken()];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/, (0, add_credentials_to_metadata_1.addCredentialsToMetadata)(this.token)];
                }
            });
        });
    };
    return IamAuthService;
}());
exports.IamAuthService = IamAuthService;
