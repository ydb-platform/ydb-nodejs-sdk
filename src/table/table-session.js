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
exports.AlterTableDescription = exports.TableDescription = exports.TtlSettings = exports.TableIndex = exports.TableProfile = exports.CachingPolicy = exports.ExecutionPolicy = exports.CompactionPolicy = exports.ReplicationPolicy = exports.PartitioningPolicy = exports.ExplicitPartitions = exports.StoragePolicy = exports.ColumnFamilyPolicy = exports.StorageSettings = exports.Column = exports.TableSession = exports.ExecuteScanQuerySettings = exports.ReadTableSettings = exports.BulkUpsertSettings = exports.ExecuteQuerySettings = exports.PrepareQuerySettings = exports.RollbackTransactionSettings = exports.CommitTransactionSettings = exports.BeginTransactionSettings = exports.DescribeTableSettings = exports.DropTableSettings = exports.AlterTableSettings = exports.CreateTableSettings = exports.OperationParamsSettings = exports.OperationParams = exports.AUTO_TX = void 0;
var ydb_sdk_proto_1 = require("ydb-sdk-proto");
var DescribeTableResult = ydb_sdk_proto_1.Ydb.Table.DescribeTableResult;
var PrepareQueryResult = ydb_sdk_proto_1.Ydb.Table.PrepareQueryResult;
var ExecuteQueryResult = ydb_sdk_proto_1.Ydb.Table.ExecuteQueryResult;
var ExplainQueryResult = ydb_sdk_proto_1.Ydb.Table.ExplainQueryResult;
var BeginTransactionResult = ydb_sdk_proto_1.Ydb.Table.BeginTransactionResult;
var ExecuteScanQueryPartialResult = ydb_sdk_proto_1.Ydb.Table.ExecuteScanQueryPartialResult;
var BulkUpsertResult = ydb_sdk_proto_1.Ydb.Table.BulkUpsertResult;
var OperationMode = ydb_sdk_proto_1.Ydb.Operations.OperationParams.OperationMode;
var events_1 = require("events");
var table_session_pool_1 = require("./table-session-pool");
var retries_obsoleted_1 = require("../retries_obsoleted");
var errors_1 = require("../errors");
var constants_1 = require("../constants");
var utils_1 = require("../utils");
var process_ydb_operation_result_1 = require("../utils/process-ydb-operation-result");
var utils_2 = require("../utils");
exports.AUTO_TX = {
    beginTx: {
        serializableReadWrite: {}
    },
    commitTx: true
};
var OperationParams = /** @class */ (function () {
    function OperationParams() {
    }
    OperationParams.prototype.withSyncMode = function () {
        this.operationMode = OperationMode.SYNC;
        return this;
    };
    OperationParams.prototype.withAsyncMode = function () {
        this.operationMode = OperationMode.ASYNC;
        return this;
    };
    OperationParams.prototype.withOperationTimeout = function (duration) {
        this.operationTimeout = duration;
        return this;
    };
    OperationParams.prototype.withOperationTimeoutSeconds = function (seconds) {
        this.operationTimeout = { seconds: seconds };
        return this;
    };
    OperationParams.prototype.withCancelAfter = function (duration) {
        this.cancelAfter = duration;
        return this;
    };
    OperationParams.prototype.withCancelAfterSeconds = function (seconds) {
        this.cancelAfter = { seconds: seconds };
        return this;
    };
    OperationParams.prototype.withLabels = function (labels) {
        this.labels = labels;
        return this;
    };
    OperationParams.prototype.withReportCostInfo = function () {
        this.reportCostInfo = ydb_sdk_proto_1.Ydb.FeatureFlag.Status.ENABLED;
        return this;
    };
    return OperationParams;
}());
exports.OperationParams = OperationParams;
var OperationParamsSettings = /** @class */ (function () {
    function OperationParamsSettings() {
    }
    OperationParamsSettings.prototype.withOperationParams = function (operationParams) {
        this.operationParams = operationParams;
        return this;
    };
    return OperationParamsSettings;
}());
exports.OperationParamsSettings = OperationParamsSettings;
var CreateTableSettings = /** @class */ (function (_super) {
    __extends(CreateTableSettings, _super);
    function CreateTableSettings() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return CreateTableSettings;
}(OperationParamsSettings));
exports.CreateTableSettings = CreateTableSettings;
var AlterTableSettings = /** @class */ (function (_super) {
    __extends(AlterTableSettings, _super);
    function AlterTableSettings() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return AlterTableSettings;
}(OperationParamsSettings));
exports.AlterTableSettings = AlterTableSettings;
var DropTableSettings = /** @class */ (function (_super) {
    __extends(DropTableSettings, _super);
    function DropTableSettings(_a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.muteNonExistingTableErrors, muteNonExistingTableErrors = _c === void 0 ? true : _c;
        var _this = _super.call(this) || this;
        _this.muteNonExistingTableErrors = muteNonExistingTableErrors;
        return _this;
    }
    return DropTableSettings;
}(OperationParamsSettings));
exports.DropTableSettings = DropTableSettings;
var DescribeTableSettings = /** @class */ (function (_super) {
    __extends(DescribeTableSettings, _super);
    function DescribeTableSettings() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DescribeTableSettings.prototype.withIncludeShardKeyBounds = function (includeShardKeyBounds) {
        this.includeShardKeyBounds = includeShardKeyBounds;
        return this;
    };
    DescribeTableSettings.prototype.withIncludeTableStats = function (includeTableStats) {
        this.includeTableStats = includeTableStats;
        return this;
    };
    DescribeTableSettings.prototype.withIncludePartitionStats = function (includePartitionStats) {
        this.includePartitionStats = includePartitionStats;
        return this;
    };
    return DescribeTableSettings;
}(OperationParamsSettings));
exports.DescribeTableSettings = DescribeTableSettings;
var BeginTransactionSettings = /** @class */ (function (_super) {
    __extends(BeginTransactionSettings, _super);
    function BeginTransactionSettings() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return BeginTransactionSettings;
}(OperationParamsSettings));
exports.BeginTransactionSettings = BeginTransactionSettings;
var CommitTransactionSettings = /** @class */ (function (_super) {
    __extends(CommitTransactionSettings, _super);
    function CommitTransactionSettings() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    CommitTransactionSettings.prototype.withCollectStats = function (collectStats) {
        this.collectStats = collectStats;
        return this;
    };
    return CommitTransactionSettings;
}(OperationParamsSettings));
exports.CommitTransactionSettings = CommitTransactionSettings;
var RollbackTransactionSettings = /** @class */ (function (_super) {
    __extends(RollbackTransactionSettings, _super);
    function RollbackTransactionSettings() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return RollbackTransactionSettings;
}(OperationParamsSettings));
exports.RollbackTransactionSettings = RollbackTransactionSettings;
var PrepareQuerySettings = /** @class */ (function (_super) {
    __extends(PrepareQuerySettings, _super);
    function PrepareQuerySettings() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PrepareQuerySettings;
}(OperationParamsSettings));
exports.PrepareQuerySettings = PrepareQuerySettings;
var ExecuteQuerySettings = /** @class */ (function (_super) {
    __extends(ExecuteQuerySettings, _super);
    function ExecuteQuerySettings() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.keepInCache = false;
        return _this;
    }
    ExecuteQuerySettings.prototype.withKeepInCache = function (keepInCache) {
        this.keepInCache = keepInCache;
        return this;
    };
    ExecuteQuerySettings.prototype.withCollectStats = function (collectStats) {
        this.collectStats = collectStats;
        return this;
    };
    return ExecuteQuerySettings;
}(OperationParamsSettings));
exports.ExecuteQuerySettings = ExecuteQuerySettings;
var BulkUpsertSettings = /** @class */ (function (_super) {
    __extends(BulkUpsertSettings, _super);
    function BulkUpsertSettings() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return BulkUpsertSettings;
}(OperationParamsSettings));
exports.BulkUpsertSettings = BulkUpsertSettings;
var ReadTableSettings = /** @class */ (function () {
    function ReadTableSettings() {
    }
    ReadTableSettings.prototype.withRowLimit = function (rowLimit) {
        this.rowLimit = rowLimit;
        return this;
    };
    ReadTableSettings.prototype.withColumns = function () {
        var columns = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            columns[_i] = arguments[_i];
        }
        this.columns = columns;
        return this;
    };
    ReadTableSettings.prototype.withOrdered = function (ordered) {
        this.ordered = ordered;
        return this;
    };
    ReadTableSettings.prototype.withKeyRange = function (keyRange) {
        this.keyRange = keyRange;
        return this;
    };
    ReadTableSettings.prototype.withKeyGreater = function (value) {
        this.getOrInitKeyRange().greater = value;
        return this;
    };
    ReadTableSettings.prototype.withKeyGreaterOrEqual = function (value) {
        this.getOrInitKeyRange().greaterOrEqual = value;
        return this;
    };
    ReadTableSettings.prototype.withKeyLess = function (value) {
        this.getOrInitKeyRange().less = value;
        return this;
    };
    ReadTableSettings.prototype.withKeyLessOrEqual = function (value) {
        this.getOrInitKeyRange().lessOrEqual = value;
        return this;
    };
    ReadTableSettings.prototype.getOrInitKeyRange = function () {
        if (!this.keyRange) {
            this.keyRange = {};
        }
        return this.keyRange;
    };
    return ReadTableSettings;
}());
exports.ReadTableSettings = ReadTableSettings;
var ExecuteScanQuerySettings = /** @class */ (function () {
    function ExecuteScanQuerySettings() {
    }
    ExecuteScanQuerySettings.prototype.withMode = function (mode) {
        this.mode = mode;
        return this;
    };
    ExecuteScanQuerySettings.prototype.withCollectStats = function (collectStats) {
        this.collectStats = collectStats;
        return this;
    };
    return ExecuteScanQuerySettings;
}());
exports.ExecuteScanQuerySettings = ExecuteScanQuerySettings;
var TableSession = function () {
    var _a;
    var _classSuper = events_1.default;
    var _instanceExtraInitializers = [];
    var _delete_decorators;
    var _keepAlive_decorators;
    var _createTable_decorators;
    var _alterTable_decorators;
    var _dropTable_decorators;
    var _describeTable_decorators;
    var _describeTableOptions_decorators;
    var _beginTransaction_decorators;
    var _commitTransaction_decorators;
    var _rollbackTransaction_decorators;
    var _prepareQuery_decorators;
    var _executeQuery_decorators;
    var _bulkUpsert_decorators;
    var _streamReadTable_decorators;
    var _streamExecuteScanQuery_decorators;
    return _a = /** @class */ (function (_super) {
            __extends(TableSession, _super);
            function TableSession(api, endpoint, sessionId, logger, getResponseMetadata) {
                var _this = _super.call(this) || this;
                _this.api = (__runInitializers(_this, _instanceExtraInitializers), api);
                _this.endpoint = endpoint;
                _this.sessionId = sessionId;
                _this.logger = logger;
                _this.getResponseMetadata = getResponseMetadata;
                _this.beingDeleted = false;
                _this.free = true;
                _this.closing = false;
                return _this;
            }
            TableSession.prototype.acquire = function () {
                this.free = false;
                this.logger.debug("Acquired session ".concat(this.sessionId, " on endpoint ").concat(this.endpoint.toString(), "."));
                return this;
            };
            TableSession.prototype.release = function () {
                this.free = true;
                this.logger.debug("Released session ".concat(this.sessionId, " on endpoint ").concat(this.endpoint.toString(), "."));
                this.emit(table_session_pool_1.SessionEvent.SESSION_RELEASE, this);
            };
            TableSession.prototype.isFree = function () {
                return this.free && !this.isDeleted();
            };
            TableSession.prototype.isClosing = function () {
                return this.closing;
            };
            TableSession.prototype.isDeleted = function () {
                return this.beingDeleted;
            };
            TableSession.prototype.delete = function () {
                return __awaiter(this, void 0, void 0, function () {
                    var _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                if (this.isDeleted()) {
                                    return [2 /*return*/, Promise.resolve()];
                                }
                                this.beingDeleted = true;
                                _b = process_ydb_operation_result_1.ensureOperationSucceeded;
                                return [4 /*yield*/, this.api.deleteSession({ sessionId: this.sessionId })];
                            case 1:
                                _b.apply(void 0, [_c.sent()]);
                                return [2 /*return*/];
                        }
                    });
                });
            };
            TableSession.prototype.keepAlive = function () {
                return __awaiter(this, void 0, void 0, function () {
                    var request, response;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                request = { sessionId: this.sessionId };
                                return [4 /*yield*/, this.api.keepAlive(request)];
                            case 1:
                                response = _b.sent();
                                (0, process_ydb_operation_result_1.ensureOperationSucceeded)(this.processResponseMetadata(request, response));
                                return [2 /*return*/];
                        }
                    });
                });
            };
            TableSession.prototype.createTable = function (tablePath, description, settings) {
                return __awaiter(this, void 0, void 0, function () {
                    var request, response;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                request = __assign(__assign({}, description), { sessionId: this.sessionId, path: "".concat(this.endpoint.database, "/").concat(tablePath) });
                                if (settings) {
                                    request.operationParams = settings.operationParams;
                                }
                                return [4 /*yield*/, this.api.createTable(request)];
                            case 1:
                                response = _b.sent();
                                (0, process_ydb_operation_result_1.ensureOperationSucceeded)(this.processResponseMetadata(request, response));
                                return [2 /*return*/];
                        }
                    });
                });
            };
            TableSession.prototype.alterTable = function (tablePath, description, settings) {
                return __awaiter(this, void 0, void 0, function () {
                    var request, response;
                    var _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                request = __assign(__assign({}, description), { sessionId: this.sessionId, path: "".concat(this.endpoint.database, "/").concat(tablePath) });
                                if (settings) {
                                    request.operationParams = settings.operationParams;
                                }
                                return [4 /*yield*/, this.api.alterTable(request)];
                            case 1:
                                response = _c.sent();
                                try {
                                    (0, process_ydb_operation_result_1.ensureOperationSucceeded)(this.processResponseMetadata(request, response));
                                }
                                catch (error) {
                                    // !! does not returns response status if async operation mode
                                    if (((_b = request.operationParams) === null || _b === void 0 ? void 0 : _b.operationMode) !== OperationMode.SYNC && error instanceof errors_1.MissingStatus)
                                        return [2 /*return*/];
                                    throw error;
                                }
                                return [2 /*return*/];
                        }
                    });
                });
            };
            /*
             Drop table located at `tablePath` in the current database. By default dropping non-existent tables does not
             throw an error, to throw an error pass `new DropTableSettings({muteNonExistingTableErrors: true})` as 2nd argument.
             */
            TableSession.prototype.dropTable = function (tablePath, settings) {
                return __awaiter(this, void 0, void 0, function () {
                    var request, suppressedErrors, response;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                request = {
                                    sessionId: this.sessionId,
                                    path: "".concat(this.endpoint.database, "/").concat(tablePath),
                                };
                                if (settings) {
                                    request.operationParams = settings.operationParams;
                                }
                                settings = settings || new DropTableSettings();
                                suppressedErrors = (settings === null || settings === void 0 ? void 0 : settings.muteNonExistingTableErrors) ? [errors_1.SchemeError.status] : [];
                                return [4 /*yield*/, this.api.dropTable(request)];
                            case 1:
                                response = _b.sent();
                                (0, process_ydb_operation_result_1.ensureOperationSucceeded)(this.processResponseMetadata(request, response), suppressedErrors);
                                return [2 /*return*/];
                        }
                    });
                });
            };
            TableSession.prototype.describeTable = function (tablePath, settings) {
                return __awaiter(this, void 0, void 0, function () {
                    var request, response, payload;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                request = {
                                    sessionId: this.sessionId,
                                    path: "".concat(this.endpoint.database, "/").concat(tablePath),
                                    operationParams: settings === null || settings === void 0 ? void 0 : settings.operationParams,
                                };
                                if (settings) {
                                    request.includeTableStats = settings.includeTableStats;
                                    request.includeShardKeyBounds = settings.includeShardKeyBounds;
                                    request.includePartitionStats = settings.includePartitionStats;
                                    request.operationParams = settings.operationParams;
                                }
                                return [4 /*yield*/, this.api.describeTable(request)];
                            case 1:
                                response = _b.sent();
                                payload = (0, process_ydb_operation_result_1.getOperationPayload)(this.processResponseMetadata(request, response));
                                return [2 /*return*/, DescribeTableResult.decode(payload)];
                        }
                    });
                });
            };
            TableSession.prototype.describeTableOptions = function (settings) {
                return __awaiter(this, void 0, void 0, function () {
                    var request, response, payload;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                request = {
                                    operationParams: settings === null || settings === void 0 ? void 0 : settings.operationParams,
                                };
                                return [4 /*yield*/, this.api.describeTableOptions(request)];
                            case 1:
                                response = _b.sent();
                                payload = (0, process_ydb_operation_result_1.getOperationPayload)(this.processResponseMetadata(request, response));
                                return [2 /*return*/, ydb_sdk_proto_1.Ydb.Table.DescribeTableOptionsResult.decode(payload)];
                        }
                    });
                });
            };
            TableSession.prototype.beginTransaction = function (txSettings, settings) {
                return __awaiter(this, void 0, void 0, function () {
                    var request, response, payload, txMeta;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                request = {
                                    sessionId: this.sessionId,
                                    txSettings: txSettings,
                                };
                                if (settings) {
                                    request.operationParams = settings.operationParams;
                                }
                                return [4 /*yield*/, this.api.beginTransaction(request)];
                            case 1:
                                response = _b.sent();
                                payload = (0, process_ydb_operation_result_1.getOperationPayload)(this.processResponseMetadata(request, response));
                                txMeta = BeginTransactionResult.decode(payload).txMeta;
                                if (txMeta) {
                                    return [2 /*return*/, txMeta];
                                }
                                throw new Error('Could not begin new transaction, txMeta is empty!');
                        }
                    });
                });
            };
            TableSession.prototype.commitTransaction = function (txControl, settings) {
                return __awaiter(this, void 0, void 0, function () {
                    var request, response;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                request = {
                                    sessionId: this.sessionId,
                                    txId: txControl.txId,
                                };
                                if (settings) {
                                    request.operationParams = settings.operationParams;
                                    request.collectStats = settings.collectStats;
                                }
                                return [4 /*yield*/, this.api.commitTransaction(request)];
                            case 1:
                                response = _b.sent();
                                (0, process_ydb_operation_result_1.ensureOperationSucceeded)(this.processResponseMetadata(request, response));
                                return [2 /*return*/];
                        }
                    });
                });
            };
            TableSession.prototype.rollbackTransaction = function (txControl, settings) {
                return __awaiter(this, void 0, void 0, function () {
                    var request, response;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                request = {
                                    sessionId: this.sessionId,
                                    txId: txControl.txId,
                                };
                                if (settings) {
                                    request.operationParams = settings.operationParams;
                                }
                                return [4 /*yield*/, this.api.rollbackTransaction(request)];
                            case 1:
                                response = _b.sent();
                                (0, process_ydb_operation_result_1.ensureOperationSucceeded)(this.processResponseMetadata(request, response));
                                return [2 /*return*/];
                        }
                    });
                });
            };
            TableSession.prototype.prepareQuery = function (queryText, settings) {
                return __awaiter(this, void 0, void 0, function () {
                    var request, response, payload;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                request = {
                                    sessionId: this.sessionId,
                                    yqlText: queryText,
                                };
                                if (settings) {
                                    request.operationParams = settings.operationParams;
                                }
                                return [4 /*yield*/, this.api.prepareDataQuery(request)];
                            case 1:
                                response = _b.sent();
                                payload = (0, process_ydb_operation_result_1.getOperationPayload)(this.processResponseMetadata(request, response));
                                return [2 /*return*/, PrepareQueryResult.decode(payload)];
                        }
                    });
                });
            };
            TableSession.prototype.executeQuery = function (query_1) {
                return __awaiter(this, arguments, void 0, function (query, params, txControl, settings) {
                    var queryToExecute, keepInCache, request, response, payload;
                    if (params === void 0) { params = {}; }
                    if (txControl === void 0) { txControl = exports.AUTO_TX; }
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                this.logger.trace('preparedQuery %o', query);
                                this.logger.trace('parameters %o', params);
                                keepInCache = false;
                                if (typeof query === 'string') {
                                    queryToExecute = {
                                        yqlText: query
                                    };
                                    if ((settings === null || settings === void 0 ? void 0 : settings.keepInCache) !== undefined) {
                                        keepInCache = settings.keepInCache;
                                    }
                                }
                                else {
                                    queryToExecute = {
                                        id: query.queryId
                                    };
                                }
                                request = {
                                    sessionId: this.sessionId,
                                    txControl: txControl,
                                    parameters: params,
                                    query: queryToExecute,
                                };
                                if (settings) {
                                    request.operationParams = settings.operationParams;
                                    request.collectStats = settings.collectStats;
                                }
                                if (keepInCache) {
                                    request.queryCachePolicy = { keepInCache: keepInCache };
                                }
                                return [4 /*yield*/, this.api.executeDataQuery(request)];
                            case 1:
                                response = _a.sent();
                                payload = (0, process_ydb_operation_result_1.getOperationPayload)(this.processResponseMetadata(request, response, settings === null || settings === void 0 ? void 0 : settings.onResponseMetadata));
                                return [2 /*return*/, ExecuteQueryResult.decode(payload)];
                        }
                    });
                });
            };
            TableSession.prototype.processResponseMetadata = function (request, response, onResponseMetadata) {
                var metadata = this.getResponseMetadata(request);
                if (metadata) {
                    var serverHints = metadata.get(constants_1.ResponseMetadataKeys.ServerHints) || [];
                    if (serverHints.includes('session-close')) {
                        this.closing = true;
                    }
                    onResponseMetadata === null || onResponseMetadata === void 0 ? void 0 : onResponseMetadata(metadata);
                }
                return response;
            };
            TableSession.prototype.bulkUpsert = function (tablePath, rows, settings) {
                return __awaiter(this, void 0, void 0, function () {
                    var request, response, payload;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                request = {
                                    table: "".concat(this.endpoint.database, "/").concat(tablePath),
                                    rows: rows,
                                };
                                if (settings) {
                                    request.operationParams = settings.operationParams;
                                }
                                return [4 /*yield*/, this.api.bulkUpsert(request)];
                            case 1:
                                response = _b.sent();
                                payload = (0, process_ydb_operation_result_1.getOperationPayload)(this.processResponseMetadata(request, response));
                                return [2 /*return*/, BulkUpsertResult.decode(payload)];
                        }
                    });
                });
            };
            TableSession.prototype.streamReadTable = function (tablePath, consumer, settings) {
                return __awaiter(this, void 0, void 0, function () {
                    var request;
                    return __generator(this, function (_b) {
                        request = {
                            sessionId: this.sessionId,
                            path: "".concat(this.endpoint.database, "/").concat(tablePath),
                        };
                        if (settings) {
                            request.columns = settings.columns;
                            request.ordered = settings.ordered;
                            request.rowLimit = settings.rowLimit;
                            request.keyRange = settings.keyRange;
                        }
                        return [2 /*return*/, this.executeStreamRequest(request, this.api.streamReadTable.bind(this.api), ydb_sdk_proto_1.Ydb.Table.ReadTableResult.create, consumer)];
                    });
                });
            };
            TableSession.prototype.streamExecuteScanQuery = function (query_1, consumer_1) {
                return __awaiter(this, arguments, void 0, function (query, consumer, params, settings) {
                    var queryToExecute, request;
                    if (params === void 0) { params = {}; }
                    return __generator(this, function (_a) {
                        if (typeof query === 'string') {
                            queryToExecute = {
                                yqlText: query
                            };
                        }
                        else {
                            queryToExecute = {
                                id: query.queryId
                            };
                        }
                        request = {
                            query: queryToExecute,
                            parameters: params,
                            mode: (settings === null || settings === void 0 ? void 0 : settings.mode) || ydb_sdk_proto_1.Ydb.Table.ExecuteScanQueryRequest.Mode.MODE_EXEC,
                        };
                        if (settings) {
                            request.collectStats = settings.collectStats;
                        }
                        return [2 /*return*/, this.executeStreamRequest(request, this.api.streamExecuteScanQuery.bind(this.api), ExecuteScanQueryPartialResult.create, consumer)];
                    });
                });
            };
            TableSession.prototype.executeStreamRequest = function (request, apiStreamMethod, transformer, consumer) {
                return new Promise(function (resolve, reject) {
                    apiStreamMethod(request, function (error, response) {
                        try {
                            if (error) {
                                if (error instanceof utils_2.StreamEnd) {
                                    resolve();
                                }
                                else {
                                    reject(error);
                                }
                            }
                            else if (response) {
                                var operation = {
                                    status: response.status,
                                    issues: response.issues,
                                };
                                errors_1.YdbError.checkStatus(operation);
                                if (!response.result) {
                                    reject(new errors_1.MissingValue('Missing result value!'));
                                    return;
                                }
                                var result = transformer(response.result);
                                consumer(result);
                            }
                        }
                        catch (e) {
                            reject(e);
                        }
                    });
                });
            };
            TableSession.prototype.explainQuery = function (query, operationParams) {
                return __awaiter(this, void 0, void 0, function () {
                    var request, response, payload;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                request = {
                                    sessionId: this.sessionId,
                                    yqlText: query,
                                    operationParams: operationParams
                                };
                                return [4 /*yield*/, this.api.explainDataQuery(request)];
                            case 1:
                                response = _b.sent();
                                payload = (0, process_ydb_operation_result_1.getOperationPayload)(this.processResponseMetadata(request, response));
                                return [2 /*return*/, ExplainQueryResult.decode(payload)];
                        }
                    });
                });
            };
            return TableSession;
        }(_classSuper)),
        (function () {
            var _b;
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_b = _classSuper[Symbol.metadata]) !== null && _b !== void 0 ? _b : null) : void 0;
            _delete_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable];
            _keepAlive_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable];
            _createTable_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable];
            _alterTable_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable];
            _dropTable_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable];
            _describeTable_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable];
            _describeTableOptions_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable];
            _beginTransaction_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable];
            _commitTransaction_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable];
            _rollbackTransaction_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable];
            _prepareQuery_decorators = [(0, retries_obsoleted_1.retryable)(), utils_1.pessimizable];
            _executeQuery_decorators = [utils_1.pessimizable];
            _bulkUpsert_decorators = [utils_1.pessimizable];
            _streamReadTable_decorators = [utils_1.pessimizable];
            _streamExecuteScanQuery_decorators = [utils_1.pessimizable];
            __esDecorate(_a, null, _delete_decorators, { kind: "method", name: "delete", static: false, private: false, access: { has: function (obj) { return "delete" in obj; }, get: function (obj) { return obj.delete; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _keepAlive_decorators, { kind: "method", name: "keepAlive", static: false, private: false, access: { has: function (obj) { return "keepAlive" in obj; }, get: function (obj) { return obj.keepAlive; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _createTable_decorators, { kind: "method", name: "createTable", static: false, private: false, access: { has: function (obj) { return "createTable" in obj; }, get: function (obj) { return obj.createTable; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _alterTable_decorators, { kind: "method", name: "alterTable", static: false, private: false, access: { has: function (obj) { return "alterTable" in obj; }, get: function (obj) { return obj.alterTable; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _dropTable_decorators, { kind: "method", name: "dropTable", static: false, private: false, access: { has: function (obj) { return "dropTable" in obj; }, get: function (obj) { return obj.dropTable; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _describeTable_decorators, { kind: "method", name: "describeTable", static: false, private: false, access: { has: function (obj) { return "describeTable" in obj; }, get: function (obj) { return obj.describeTable; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _describeTableOptions_decorators, { kind: "method", name: "describeTableOptions", static: false, private: false, access: { has: function (obj) { return "describeTableOptions" in obj; }, get: function (obj) { return obj.describeTableOptions; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _beginTransaction_decorators, { kind: "method", name: "beginTransaction", static: false, private: false, access: { has: function (obj) { return "beginTransaction" in obj; }, get: function (obj) { return obj.beginTransaction; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _commitTransaction_decorators, { kind: "method", name: "commitTransaction", static: false, private: false, access: { has: function (obj) { return "commitTransaction" in obj; }, get: function (obj) { return obj.commitTransaction; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _rollbackTransaction_decorators, { kind: "method", name: "rollbackTransaction", static: false, private: false, access: { has: function (obj) { return "rollbackTransaction" in obj; }, get: function (obj) { return obj.rollbackTransaction; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _prepareQuery_decorators, { kind: "method", name: "prepareQuery", static: false, private: false, access: { has: function (obj) { return "prepareQuery" in obj; }, get: function (obj) { return obj.prepareQuery; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _executeQuery_decorators, { kind: "method", name: "executeQuery", static: false, private: false, access: { has: function (obj) { return "executeQuery" in obj; }, get: function (obj) { return obj.executeQuery; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _bulkUpsert_decorators, { kind: "method", name: "bulkUpsert", static: false, private: false, access: { has: function (obj) { return "bulkUpsert" in obj; }, get: function (obj) { return obj.bulkUpsert; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _streamReadTable_decorators, { kind: "method", name: "streamReadTable", static: false, private: false, access: { has: function (obj) { return "streamReadTable" in obj; }, get: function (obj) { return obj.streamReadTable; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(_a, null, _streamExecuteScanQuery_decorators, { kind: "method", name: "streamExecuteScanQuery", static: false, private: false, access: { has: function (obj) { return "streamExecuteScanQuery" in obj; }, get: function (obj) { return obj.streamExecuteScanQuery; } }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.TableSession = TableSession;
var Column = /** @class */ (function () {
    function Column(name, type, family) {
        this.name = name;
        this.type = type;
        this.family = family;
    }
    return Column;
}());
exports.Column = Column;
var StorageSettings = /** @class */ (function () {
    function StorageSettings(media) {
        this.media = media;
    }
    return StorageSettings;
}());
exports.StorageSettings = StorageSettings;
var ColumnFamilyPolicy = /** @class */ (function () {
    function ColumnFamilyPolicy() {
    }
    ColumnFamilyPolicy.prototype.withName = function (name) {
        this.name = name;
        return this;
    };
    ColumnFamilyPolicy.prototype.withData = function (data) {
        this.data = data;
        return this;
    };
    ColumnFamilyPolicy.prototype.withExternal = function (external) {
        this.external = external;
        return this;
    };
    ColumnFamilyPolicy.prototype.withKeepInMemory = function (keepInMemory) {
        this.keepInMemory = keepInMemory;
        return this;
    };
    ColumnFamilyPolicy.prototype.withCompression = function (compression) {
        this.compression = compression;
        return this;
    };
    return ColumnFamilyPolicy;
}());
exports.ColumnFamilyPolicy = ColumnFamilyPolicy;
var StoragePolicy = /** @class */ (function () {
    function StoragePolicy() {
        this.columnFamilies = [];
    }
    StoragePolicy.prototype.withPresetName = function (presetName) {
        this.presetName = presetName;
        return this;
    };
    StoragePolicy.prototype.withSyslog = function (syslog) {
        this.syslog = syslog;
        return this;
    };
    StoragePolicy.prototype.withLog = function (log) {
        this.log = log;
        return this;
    };
    StoragePolicy.prototype.withData = function (data) {
        this.data = data;
        return this;
    };
    StoragePolicy.prototype.withExternal = function (external) {
        this.external = external;
        return this;
    };
    StoragePolicy.prototype.withKeepInMemory = function (keepInMemory) {
        this.keepInMemory = keepInMemory;
        return this;
    };
    StoragePolicy.prototype.withColumnFamilies = function () {
        var columnFamilies = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            columnFamilies[_i] = arguments[_i];
        }
        for (var _a = 0, columnFamilies_1 = columnFamilies; _a < columnFamilies_1.length; _a++) {
            var policy = columnFamilies_1[_a];
            this.columnFamilies.push(policy);
        }
        return this;
    };
    return StoragePolicy;
}());
exports.StoragePolicy = StoragePolicy;
var ExplicitPartitions = /** @class */ (function () {
    function ExplicitPartitions(splitPoints) {
        this.splitPoints = splitPoints;
    }
    return ExplicitPartitions;
}());
exports.ExplicitPartitions = ExplicitPartitions;
var PartitioningPolicy = /** @class */ (function () {
    function PartitioningPolicy() {
    }
    PartitioningPolicy.prototype.withPresetName = function (presetName) {
        this.presetName = presetName;
        return this;
    };
    PartitioningPolicy.prototype.withUniformPartitions = function (uniformPartitions) {
        this.uniformPartitions = uniformPartitions;
        return this;
    };
    PartitioningPolicy.prototype.withAutoPartitioning = function (autoPartitioning) {
        this.autoPartitioning = autoPartitioning;
        return this;
    };
    PartitioningPolicy.prototype.withExplicitPartitions = function (explicitPartitions) {
        this.explicitPartitions = explicitPartitions;
        return this;
    };
    return PartitioningPolicy;
}());
exports.PartitioningPolicy = PartitioningPolicy;
var ReplicationPolicy = /** @class */ (function () {
    function ReplicationPolicy() {
    }
    ReplicationPolicy.prototype.withPresetName = function (presetName) {
        this.presetName = presetName;
        return this;
    };
    ReplicationPolicy.prototype.withReplicasCount = function (replicasCount) {
        this.replicasCount = replicasCount;
        return this;
    };
    ReplicationPolicy.prototype.withCreatePerAvailabilityZone = function (createPerAvailabilityZone) {
        this.createPerAvailabilityZone = createPerAvailabilityZone;
        return this;
    };
    ReplicationPolicy.prototype.withAllowPromotion = function (allowPromotion) {
        this.allowPromotion = allowPromotion;
        return this;
    };
    return ReplicationPolicy;
}());
exports.ReplicationPolicy = ReplicationPolicy;
var CompactionPolicy = /** @class */ (function () {
    function CompactionPolicy(presetName) {
        this.presetName = presetName;
    }
    return CompactionPolicy;
}());
exports.CompactionPolicy = CompactionPolicy;
var ExecutionPolicy = /** @class */ (function () {
    function ExecutionPolicy(presetName) {
        this.presetName = presetName;
    }
    return ExecutionPolicy;
}());
exports.ExecutionPolicy = ExecutionPolicy;
var CachingPolicy = /** @class */ (function () {
    function CachingPolicy(presetName) {
        this.presetName = presetName;
    }
    return CachingPolicy;
}());
exports.CachingPolicy = CachingPolicy;
var TableProfile = /** @class */ (function () {
    function TableProfile() {
    }
    TableProfile.prototype.withPresetName = function (presetName) {
        this.presetName = presetName;
        return this;
    };
    TableProfile.prototype.withStoragePolicy = function (storagePolicy) {
        this.storagePolicy = storagePolicy;
        return this;
    };
    TableProfile.prototype.withCompactionPolicy = function (compactionPolicy) {
        this.compactionPolicy = compactionPolicy;
        return this;
    };
    TableProfile.prototype.withPartitioningPolicy = function (partitioningPolicy) {
        this.partitioningPolicy = partitioningPolicy;
        return this;
    };
    TableProfile.prototype.withExecutionPolicy = function (executionPolicy) {
        this.executionPolicy = executionPolicy;
        return this;
    };
    TableProfile.prototype.withReplicationPolicy = function (replicationPolicy) {
        this.replicationPolicy = replicationPolicy;
        return this;
    };
    TableProfile.prototype.withCachingPolicy = function (cachingPolicy) {
        this.cachingPolicy = cachingPolicy;
        return this;
    };
    return TableProfile;
}());
exports.TableProfile = TableProfile;
var TableIndex = /** @class */ (function () {
    function TableIndex(name) {
        this.name = name;
        this.indexColumns = [];
        this.dataColumns = null;
        this.globalIndex = null;
        this.globalAsyncIndex = null;
    }
    TableIndex.prototype.withIndexColumns = function () {
        var _a;
        var indexColumns = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            indexColumns[_i] = arguments[_i];
        }
        (_a = this.indexColumns).push.apply(_a, indexColumns);
        return this;
    };
    /** Adds [covering index](https://ydb.tech/en/docs/concepts/secondary_indexes#covering) over columns */
    TableIndex.prototype.withDataColumns = function () {
        var _a;
        var dataColumns = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            dataColumns[_i] = arguments[_i];
        }
        if (!this.dataColumns)
            this.dataColumns = [];
        (_a = this.dataColumns) === null || _a === void 0 ? void 0 : _a.push.apply(_a, dataColumns);
        return this;
    };
    TableIndex.prototype.withGlobalAsync = function (isAsync) {
        if (isAsync) {
            this.globalAsyncIndex = new ydb_sdk_proto_1.Ydb.Table.GlobalAsyncIndex();
            this.globalIndex = null;
        }
        else {
            this.globalAsyncIndex = null;
            this.globalIndex = new ydb_sdk_proto_1.Ydb.Table.GlobalIndex();
        }
        return this;
    };
    return TableIndex;
}());
exports.TableIndex = TableIndex;
var TtlSettings = /** @class */ (function () {
    function TtlSettings(columnName, expireAfterSeconds) {
        if (expireAfterSeconds === void 0) { expireAfterSeconds = 0; }
        this.dateTypeColumn = { columnName: columnName, expireAfterSeconds: expireAfterSeconds };
    }
    return TtlSettings;
}());
exports.TtlSettings = TtlSettings;
var TableDescription = /** @class */ (function () {
    // path and operationPrams defined in createTable,
    // columns and primaryKey are in constructor
    function TableDescription(columns, primaryKey) {
        if (columns === void 0) { columns = []; }
        if (primaryKey === void 0) { primaryKey = []; }
        this.columns = columns;
        this.primaryKey = primaryKey;
        this.indexes = [];
    }
    TableDescription.prototype.withColumn = function (column) {
        this.columns.push(column);
        return this;
    };
    TableDescription.prototype.withColumns = function () {
        var columns = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            columns[_i] = arguments[_i];
        }
        for (var _a = 0, columns_1 = columns; _a < columns_1.length; _a++) {
            var column = columns_1[_a];
            this.columns.push(column);
        }
        return this;
    };
    TableDescription.prototype.withPrimaryKey = function (key) {
        this.primaryKey.push(key);
        return this;
    };
    TableDescription.prototype.withPrimaryKeys = function () {
        var keys = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            keys[_i] = arguments[_i];
        }
        for (var _a = 0, keys_1 = keys; _a < keys_1.length; _a++) {
            var key = keys_1[_a];
            this.primaryKey.push(key);
        }
        return this;
    };
    /** @deprecated use TableDescription options instead */
    TableDescription.prototype.withProfile = function (profile) {
        this.profile = profile;
        return this;
    };
    TableDescription.prototype.withIndex = function (index) {
        this.indexes.push(index);
        return this;
    };
    TableDescription.prototype.withIndexes = function () {
        var indexes = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            indexes[_i] = arguments[_i];
        }
        for (var _a = 0, indexes_1 = indexes; _a < indexes_1.length; _a++) {
            var index = indexes_1[_a];
            this.indexes.push(index);
        }
        return this;
    };
    TableDescription.prototype.withTtl = function (columnName, expireAfterSeconds) {
        if (expireAfterSeconds === void 0) { expireAfterSeconds = 0; }
        this.ttlSettings = new TtlSettings(columnName, expireAfterSeconds);
        return this;
    };
    TableDescription.prototype.withPartitioningSettings = function (partitioningSettings) {
        this.partitioningSettings = partitioningSettings;
    };
    return TableDescription;
}());
exports.TableDescription = TableDescription;
var AlterTableDescription = /** @class */ (function () {
    function AlterTableDescription() {
        this.addColumns = [];
        this.dropColumns = [];
        this.alterColumns = [];
        this.addIndexes = [];
        this.dropIndexes = [];
    }
    AlterTableDescription.prototype.withAddColumn = function (column) {
        this.addColumns.push(column);
        return this;
    };
    AlterTableDescription.prototype.withDropColumn = function (columnName) {
        this.dropColumns.push(columnName);
        return this;
    };
    AlterTableDescription.prototype.withAlterColumn = function (column) {
        this.alterColumns.push(column);
        return this;
    };
    AlterTableDescription.prototype.withSetTtl = function (columnName, expireAfterSeconds) {
        if (expireAfterSeconds === void 0) { expireAfterSeconds = 0; }
        this.setTtlSettings = new TtlSettings(columnName, expireAfterSeconds);
        return this;
    };
    AlterTableDescription.prototype.withDropTtl = function () {
        this.dropTtlSettings = {};
        return this;
    };
    return AlterTableDescription;
}());
exports.AlterTableDescription = AlterTableDescription;
