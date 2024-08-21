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
exports.AuthenticatedService = exports.GrpcService = exports.StreamEnd = void 0;
var grpc = require("@grpc/grpc-js");
var version_1 = require("../version");
var lodash_1 = require("lodash");
function getDatabaseHeader(database) {
    return ['x-ydb-database', database];
}
function removeProtocol(endpoint) {
    var re = /^(grpc:\/\/|grpcs:\/\/)?(.+)/;
    var match = re.exec(endpoint);
    return match[2];
}
var StreamEnd = /** @class */ (function (_super) {
    __extends(StreamEnd, _super);
    function StreamEnd() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return StreamEnd;
}(Error));
exports.StreamEnd = StreamEnd;
var GrpcService = /** @class */ (function () {
    function GrpcService(host, name, apiCtor, sslCredentials) {
        this.name = name;
        this.apiCtor = apiCtor;
        this.api = this.getClient(removeProtocol(host), sslCredentials);
    }
    GrpcService.prototype.getClient = function (host, sslCredentials) {
        var _this = this;
        // TODO: Change to one grpc connect all services per endpoint.  Ensure that improves SLO
        var client = sslCredentials ?
            new grpc.Client(host, grpc.credentials.createSsl(sslCredentials.rootCertificates, sslCredentials.clientPrivateKey, sslCredentials.clientCertChain)) :
            new grpc.Client(host, grpc.credentials.createInsecure());
        var rpcImpl = function (method, requestData, callback) {
            if (null === method && requestData === null && callback === null) {
                // signal `end` from protobuf service
                client.close();
                return;
            }
            var path = "/".concat(_this.name, "/").concat(method.name);
            client.makeUnaryRequest(path, lodash_1.default.identity, lodash_1.default.identity, requestData, callback);
        };
        return this.apiCtor.create(rpcImpl);
    };
    return GrpcService;
}());
exports.GrpcService = GrpcService;
var AuthenticatedService = /** @class */ (function () {
    function AuthenticatedService(host, database, name, apiCtor, authService, sslCredentials, clientOptions, streamMethods) {
        var _this = this;
        this.name = name;
        this.apiCtor = apiCtor;
        this.authService = authService;
        this.sslCredentials = sslCredentials;
        this.streamMethods = streamMethods;
        this.headers = new Map([(0, version_1.getVersionHeader)(), getDatabaseHeader(database)]);
        this.metadata = new grpc.Metadata();
        this.responseMetadata = new WeakMap();
        this.api = new Proxy(this.getClient(removeProtocol(host), this.sslCredentials, clientOptions), {
            get: function (target, prop, receiver) {
                var property = Reflect.get(target, prop, receiver);
                return AuthenticatedService.isServiceAsyncMethod(target, prop, receiver) ?
                    function () {
                        var args = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            args[_i] = arguments[_i];
                        }
                        return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        if (!['emit', 'rpcCall', 'rpcImpl'].includes(String(prop))) {
                                            if (args.length) {
                                                this.lastRequest = args[0];
                                            }
                                        }
                                        return [4 /*yield*/, this.updateMetadata()];
                                    case 1:
                                        _b.sent();
                                        return [2 /*return*/, (_a = property).call.apply(_a, __spreadArray([receiver], args, false))];
                                }
                            });
                        });
                    } :
                    property;
            }
        });
    }
    AuthenticatedService.isServiceAsyncMethod = function (target, prop, receiver) {
        return (Reflect.has(target, prop) &&
            typeof Reflect.get(target, prop, receiver) === 'function' &&
            prop !== 'create');
    };
    AuthenticatedService.prototype.getResponseMetadata = function (request) {
        return this.responseMetadata.get(request);
    };
    AuthenticatedService.prototype.updateMetadata = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _i, _b, _c, name_1, value;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _a = this;
                        return [4 /*yield*/, this.authService.getAuthMetadata()];
                    case 1:
                        _a.metadata = _d.sent();
                        for (_i = 0, _b = this.headers; _i < _b.length; _i++) {
                            _c = _b[_i], name_1 = _c[0], value = _c[1];
                            if (value) {
                                this.metadata.add(name_1, value);
                            }
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    AuthenticatedService.prototype.getClient = function (host, sslCredentials, clientOptions) {
        var _this = this;
        var client = this.grpcClient = sslCredentials ?
            new grpc.Client(host, grpc.credentials.createSsl(sslCredentials.rootCertificates, sslCredentials.clientCertChain, sslCredentials.clientPrivateKey), clientOptions) :
            new grpc.Client(host, grpc.credentials.createInsecure(), clientOptions);
        var rpcImpl = function (method, requestData, callback) {
            var path = "/".concat(_this.name, "/").concat(method.name);
            if (method.name.startsWith('Stream') || (_this.streamMethods && _this.streamMethods.findIndex(function (v) { return v === method.name; }) >= 0)) {
                client.makeServerStreamRequest(path, lodash_1.default.identity, lodash_1.default.identity, requestData, _this.metadata)
                    .on('data', function (data) { return callback(null, data); })
                    .on('end', function () { return callback(new StreamEnd(), null); })
                    .on('error', function (error) { return callback(error, null); });
            }
            else {
                var req = client.makeUnaryRequest(path, lodash_1.default.identity, lodash_1.default.identity, requestData, _this.metadata, callback);
                var lastRequest_1 = _this.lastRequest;
                req.on('status', function (_a) {
                    var metadata = _a.metadata;
                    if (lastRequest_1) {
                        _this.responseMetadata.set(lastRequest_1, metadata);
                    }
                });
            }
        };
        return this.apiCtor.create(rpcImpl);
    };
    return AuthenticatedService;
}());
exports.AuthenticatedService = AuthenticatedService;
