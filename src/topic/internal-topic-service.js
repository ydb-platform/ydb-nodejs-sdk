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
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalTopicService = exports.attachStreamSymbol = exports.implSymbol = exports.grpcApiSymbol = void 0;
var topic_service_pool_1 = require("./topic-service-pool");
var utils_1 = require("../utils");
exports.grpcApiSymbol = Symbol('api');
exports.implSymbol = Symbol('impl');
exports.attachStreamSymbol = Symbol('attachStream');
;
;
;
;
;
var InternalTopicService = /** @class */ (function (_super) {
    __extends(InternalTopicService, _super);
    function InternalTopicService(endpoint, database, authService, logger, sslCredentials, clientOptions) {
        var _this = this;
        var host = endpoint.toString();
        _this = _super.call(this, host, database, 'Ydb.Topic.V1.TopicService', topic_service_pool_1.GrpcTopicService, authService, sslCredentials, clientOptions) || this;
        _this.endpoint = endpoint;
        _this.logger = logger;
        return _this;
    }
    InternalTopicService.prototype.streamWrite = function (opts) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new InternalTopicWriter(this, opts)];
            });
        });
    };
    // public streamWrite(request: Ydb.Topic.StreamWriteMessage.IFromClient): Promise<Ydb.Topic.StreamWriteMessage.FromServer>;
    //
    // public streamRead(request: Ydb.Topic.StreamReadMessage.IFromClient): Promise<Ydb.Topic.StreamReadMessage.FromServer>;
    InternalTopicService.prototype.commitOffset = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this[exports.grpcApiSymbol].commitOffset(request)];
                    case 1: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    InternalTopicService.prototype.updateOffsetsInTransaction = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this[exports.grpcApiSymbol].updateOffsetsInTransaction(request)];
                    case 1: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    InternalTopicService.prototype.createTopic = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this[exports.grpcApiSymbol].createTopic(request)];
                    case 1: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    InternalTopicService.prototype.describeTopic = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this[exports.grpcApiSymbol].describeTopic(request)];
                    case 1: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    InternalTopicService.prototype.describeConsumer = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this[exports.grpcApiSymbol].describeConsumer(request)];
                    case 1: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    InternalTopicService.prototype.alterTopic = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this[exports.grpcApiSymbol].alterTopic(request)];
                    case 1: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    InternalTopicService.prototype.dropTopic = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this[exports.grpcApiSymbol].dropTopic(request)];
                    case 1: return [2 /*return*/, (_a.sent())];
                }
            });
        });
    };
    return InternalTopicService;
}(utils_1.AuthenticatedService));
exports.InternalTopicService = InternalTopicService;
