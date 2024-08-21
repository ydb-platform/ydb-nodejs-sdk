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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemeService = exports.ModifyPermissionsSettings = exports.DescribePathSettings = exports.ListDirectorySettings = exports.RemoveDirectorySettings = exports.MakeDirectorySettings = exports.DescribePathResult = exports.ListDirectoryResult = void 0;
var ydb_sdk_proto_1 = require("ydb-sdk-proto");
var SchemeServiceAPI = ydb_sdk_proto_1.Ydb.Scheme.V1.SchemeService;
exports.ListDirectoryResult = ydb_sdk_proto_1.Ydb.Scheme.ListDirectoryResult;
exports.DescribePathResult = ydb_sdk_proto_1.Ydb.Scheme.DescribePathResult;
var table_1 = require("../table");
var utils_1 = require("../utils");
var retries_obsoleted_1 = require("../retries_obsoleted");
var process_ydb_operation_result_1 = require("../utils/process-ydb-operation-result");
function preparePermissions(action) {
    if (action && action.permissionNames) {
        return __assign(__assign({}, action), { permissionNames: action.permissionNames.map(function (name) { return name.startsWith('ydb.generic.') ? name : "ydb.generic.".concat(name); }) });
    }
    return action;
}
function preparePermissionAction(action) {
    var grant = action.grant, revoke = action.revoke, set = action.set, rest = __rest(action, ["grant", "revoke", "set"]);
    return __assign(__assign({}, rest), { grant: preparePermissions(grant), revoke: preparePermissions(revoke), set: preparePermissions(set) });
}
var MakeDirectorySettings = /** @class */ (function (_super) {
    __extends(MakeDirectorySettings, _super);
    function MakeDirectorySettings() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return MakeDirectorySettings;
}(table_1.OperationParamsSettings));
exports.MakeDirectorySettings = MakeDirectorySettings;
var RemoveDirectorySettings = /** @class */ (function (_super) {
    __extends(RemoveDirectorySettings, _super);
    function RemoveDirectorySettings() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return RemoveDirectorySettings;
}(table_1.OperationParamsSettings));
exports.RemoveDirectorySettings = RemoveDirectorySettings;
var ListDirectorySettings = /** @class */ (function (_super) {
    __extends(ListDirectorySettings, _super);
    function ListDirectorySettings() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return ListDirectorySettings;
}(table_1.OperationParamsSettings));
exports.ListDirectorySettings = ListDirectorySettings;
var DescribePathSettings = /** @class */ (function (_super) {
    __extends(DescribePathSettings, _super);
    function DescribePathSettings() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return DescribePathSettings;
}(table_1.OperationParamsSettings));
exports.DescribePathSettings = DescribePathSettings;
var ModifyPermissionsSettings = /** @class */ (function (_super) {
    __extends(ModifyPermissionsSettings, _super);
    function ModifyPermissionsSettings() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return ModifyPermissionsSettings;
}(table_1.OperationParamsSettings));
exports.ModifyPermissionsSettings = ModifyPermissionsSettings;
var SchemeService = function () {
    var _a;
    var _classSuper = utils_1.AuthenticatedService;
    var _instanceExtraInitializers = [];
    var _makeDirectory_decorators;
    var _removeDirectory_decorators;
    var _listDirectory_decorators;
    var _describePath_decorators;
    var _modifyPermissions_decorators;
    return _a = /** @class */ (function (_super) {
            __extends(SchemeService, _super);
            function SchemeService(endpoint, database, authService, logger, sslCredentials, clientOptions) {
                var _this = this;
                var host = endpoint.toString();
                _this = _super.call(this, host, database, 'Ydb.Scheme.V1.SchemeService', SchemeServiceAPI, authService, sslCredentials, clientOptions) || this;
                _this.logger = __runInitializers(_this, _instanceExtraInitializers);
                _this.endpoint = endpoint;
                _this.database = database;
                _this.logger = logger;
                return _this;
            }
            SchemeService.prototype.prepareRequest = function (path, settings) {
                return {
                    path: "".concat(this.database, "/").concat(path),
                    operationParams: settings === null || settings === void 0 ? void 0 : settings.operationParams,
                };
            };
            SchemeService.prototype.makeDirectory = function (path, settings) {
                return __awaiter(this, void 0, void 0, function () {
                    var request, _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                request = this.prepareRequest(path, settings);
                                this.logger.debug("Making directory ".concat(request.path));
                                _b = process_ydb_operation_result_1.ensureOperationSucceeded;
                                return [4 /*yield*/, this.api.makeDirectory(request)];
                            case 1:
                                _b.apply(void 0, [_c.sent()]);
                                return [2 /*return*/];
                        }
                    });
                });
            };
            SchemeService.prototype.removeDirectory = function (path, settings) {
                return __awaiter(this, void 0, void 0, function () {
                    var request, _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                request = this.prepareRequest(path, settings);
                                this.logger.debug("Removing directory ".concat(request.path));
                                _b = process_ydb_operation_result_1.ensureOperationSucceeded;
                                return [4 /*yield*/, this.api.removeDirectory(request)];
                            case 1:
                                _b.apply(void 0, [_c.sent()]);
                                return [2 /*return*/];
                        }
                    });
                });
            };
            SchemeService.prototype.listDirectory = function (path, settings) {
                return __awaiter(this, void 0, void 0, function () {
                    var request, response, payload;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                request = this.prepareRequest(path, settings);
                                this.logger.debug("Listing directory ".concat(request.path, " contents"));
                                return [4 /*yield*/, this.api.listDirectory(request)];
                            case 1:
                                response = _b.sent();
                                payload = (0, process_ydb_operation_result_1.getOperationPayload)(response);
                                return [2 /*return*/, exports.ListDirectoryResult.decode(payload)];
                        }
                    });
                });
            };
            SchemeService.prototype.describePath = function (path, settings) {
                return __awaiter(this, void 0, void 0, function () {
                    var request, response, payload;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                request = this.prepareRequest(path, settings);
                                this.logger.debug("Describing path ".concat(request.path));
                                return [4 /*yield*/, this.api.describePath(request)];
                            case 1:
                                response = _b.sent();
                                payload = (0, process_ydb_operation_result_1.getOperationPayload)(response);
                                return [2 /*return*/, exports.DescribePathResult.decode(payload)];
                        }
                    });
                });
            };
            SchemeService.prototype.modifyPermissions = function (path, permissionActions, clearPermissions, settings) {
                return __awaiter(this, void 0, void 0, function () {
                    var request, _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                request = __assign(__assign({}, this.prepareRequest(path, settings)), { actions: permissionActions.map(preparePermissionAction), clearPermissions: clearPermissions });
                                this.logger.debug("Modifying permissions on path ".concat(request.path, " to ").concat(JSON.stringify(permissionActions, null, 2)));
                                _b = process_ydb_operation_result_1.ensureOperationSucceeded;
                                return [4 /*yield*/, this.api.modifyPermissions(request)];
                            case 1:
                                _b.apply(void 0, [_c.sent()]);
                                return [2 /*return*/];
                        }
                    });
                });
            };
            return SchemeService;
        }(_classSuper)),
        (function () {
            var _b;
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_b = _classSuper[Symbol.metadata]) !== null && _b !== void 0 ? _b : null) : void 0;
            _makeDirectory_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable];
            _removeDirectory_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable];
            _listDirectory_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable];
            _describePath_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable];
            _modifyPermissions_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable];
            __esDecorate(_a, null, _makeDirectory_decorators, { kind: "method", name: "makeDirectory", static: false, private: false, access: { has: function (obj) { return "makeDirectory" in obj; }, get: function (obj) { return obj.makeDirectory; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _removeDirectory_decorators, { kind: "method", name: "removeDirectory", static: false, private: false, access: { has: function (obj) { return "removeDirectory" in obj; }, get: function (obj) { return obj.removeDirectory; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _listDirectory_decorators, { kind: "method", name: "listDirectory", static: false, private: false, access: { has: function (obj) { return "listDirectory" in obj; }, get: function (obj) { return obj.listDirectory; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _describePath_decorators, { kind: "method", name: "describePath", static: false, private: false, access: { has: function (obj) { return "describePath" in obj; }, get: function (obj) { return obj.describePath; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _modifyPermissions_decorators, { kind: "method", name: "modifyPermissions", static: false, private: false, access: { has: function (obj) { return "modifyPermissions" in obj; }, get: function (obj) { return obj.modifyPermissions; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.SchemeService = SchemeService;
