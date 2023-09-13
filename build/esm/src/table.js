"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlterTableDescription = exports.TableDescription = exports.TtlSettings = exports.TableIndex = exports.TableProfile = exports.CachingPolicy = exports.ExecutionPolicy = exports.CompactionPolicy = exports.ReplicationPolicy = exports.PartitioningPolicy = exports.ExplicitPartitions = exports.StoragePolicy = exports.ColumnFamilyPolicy = exports.StorageSettings = exports.Column = exports.TableClient = exports.SessionPool = exports.Session = exports.ExecuteScanQuerySettings = exports.ReadTableSettings = exports.BulkUpsertSettings = exports.ExecuteQuerySettings = exports.PrepareQuerySettings = exports.RollbackTransactionSettings = exports.CommitTransactionSettings = exports.BeginTransactionSettings = exports.DescribeTableSettings = exports.DropTableSettings = exports.AlterTableSettings = exports.CreateTableSettings = exports.OperationParamsSettings = exports.OperationParams = exports.AUTO_TX = exports.SessionService = void 0;
const lodash_1 = __importDefault(require("lodash"));
const events_1 = __importDefault(require("events"));
const ydb_sdk_proto_1 = require("ydb-sdk-proto");
const utils_1 = require("./utils");
const constants_1 = require("./constants");
const retries_1 = require("./retries");
const errors_1 = require("./errors");
var TableService = ydb_sdk_proto_1.Ydb.Table.V1.TableService;
var CreateSessionRequest = ydb_sdk_proto_1.Ydb.Table.CreateSessionRequest;
var CreateSessionResult = ydb_sdk_proto_1.Ydb.Table.CreateSessionResult;
var DescribeTableResult = ydb_sdk_proto_1.Ydb.Table.DescribeTableResult;
var PrepareQueryResult = ydb_sdk_proto_1.Ydb.Table.PrepareQueryResult;
var ExecuteQueryResult = ydb_sdk_proto_1.Ydb.Table.ExecuteQueryResult;
var ExplainQueryResult = ydb_sdk_proto_1.Ydb.Table.ExplainQueryResult;
var BeginTransactionResult = ydb_sdk_proto_1.Ydb.Table.BeginTransactionResult;
var ExecuteScanQueryPartialResult = ydb_sdk_proto_1.Ydb.Table.ExecuteScanQueryPartialResult;
var BulkUpsertResult = ydb_sdk_proto_1.Ydb.Table.BulkUpsertResult;
var OperationMode = ydb_sdk_proto_1.Ydb.Operations.OperationParams.OperationMode;
class SessionService extends utils_1.AuthenticatedService {
    endpoint;
    logger;
    constructor(endpoint, database, authService, logger, sslCredentials, clientOptions) {
        const host = endpoint.toString();
        super(host, database, 'Ydb.Table.V1.TableService', TableService, authService, sslCredentials, clientOptions);
        this.endpoint = endpoint;
        this.logger = logger;
    }
    async create() {
        const response = await this.api.createSession(CreateSessionRequest.create());
        const payload = (0, utils_1.getOperationPayload)(response);
        const { sessionId } = CreateSessionResult.decode(payload);
        return new Session(this.api, this.endpoint, sessionId, this.logger, this.getResponseMetadata.bind(this));
    }
}
__decorate([
    (0, retries_1.retryable)(),
    utils_1.pessimizable
], SessionService.prototype, "create", null);
exports.SessionService = SessionService;
var SessionEvent;
(function (SessionEvent) {
    SessionEvent["SESSION_RELEASE"] = "SESSION_RELEASE";
    SessionEvent["SESSION_BROKEN"] = "SESSION_BROKEN";
})(SessionEvent || (SessionEvent = {}));
exports.AUTO_TX = {
    beginTx: {
        serializableReadWrite: {}
    },
    commitTx: true
};
class OperationParams {
    operationMode;
    operationTimeout;
    cancelAfter;
    labels;
    reportCostInfo;
    withSyncMode() {
        this.operationMode = OperationMode.SYNC;
        return this;
    }
    withAsyncMode() {
        this.operationMode = OperationMode.ASYNC;
        return this;
    }
    withOperationTimeout(duration) {
        this.operationTimeout = duration;
        return this;
    }
    withOperationTimeoutSeconds(seconds) {
        this.operationTimeout = { seconds };
        return this;
    }
    withCancelAfter(duration) {
        this.cancelAfter = duration;
        return this;
    }
    withCancelAfterSeconds(seconds) {
        this.cancelAfter = { seconds };
        return this;
    }
    withLabels(labels) {
        this.labels = labels;
        return this;
    }
    withReportCostInfo() {
        this.reportCostInfo = ydb_sdk_proto_1.Ydb.FeatureFlag.Status.ENABLED;
        return this;
    }
}
exports.OperationParams = OperationParams;
class OperationParamsSettings {
    operationParams;
    withOperationParams(operationParams) {
        this.operationParams = operationParams;
        return this;
    }
}
exports.OperationParamsSettings = OperationParamsSettings;
class CreateTableSettings extends OperationParamsSettings {
}
exports.CreateTableSettings = CreateTableSettings;
class AlterTableSettings extends OperationParamsSettings {
}
exports.AlterTableSettings = AlterTableSettings;
class DropTableSettings extends OperationParamsSettings {
    muteNonExistingTableErrors;
    constructor({ muteNonExistingTableErrors = true } = {}) {
        super();
        this.muteNonExistingTableErrors = muteNonExistingTableErrors;
    }
}
exports.DropTableSettings = DropTableSettings;
class DescribeTableSettings extends OperationParamsSettings {
    includeShardKeyBounds;
    includeTableStats;
    includePartitionStats;
    withIncludeShardKeyBounds(includeShardKeyBounds) {
        this.includeShardKeyBounds = includeShardKeyBounds;
        return this;
    }
    withIncludeTableStats(includeTableStats) {
        this.includeTableStats = includeTableStats;
        return this;
    }
    withIncludePartitionStats(includePartitionStats) {
        this.includePartitionStats = includePartitionStats;
        return this;
    }
}
exports.DescribeTableSettings = DescribeTableSettings;
class BeginTransactionSettings extends OperationParamsSettings {
}
exports.BeginTransactionSettings = BeginTransactionSettings;
class CommitTransactionSettings extends OperationParamsSettings {
    collectStats;
    withCollectStats(collectStats) {
        this.collectStats = collectStats;
        return this;
    }
}
exports.CommitTransactionSettings = CommitTransactionSettings;
class RollbackTransactionSettings extends OperationParamsSettings {
}
exports.RollbackTransactionSettings = RollbackTransactionSettings;
class PrepareQuerySettings extends OperationParamsSettings {
}
exports.PrepareQuerySettings = PrepareQuerySettings;
class ExecuteQuerySettings extends OperationParamsSettings {
    keepInCache = false;
    collectStats;
    onResponseMetadata;
    withKeepInCache(keepInCache) {
        this.keepInCache = keepInCache;
        return this;
    }
    withCollectStats(collectStats) {
        this.collectStats = collectStats;
        return this;
    }
}
exports.ExecuteQuerySettings = ExecuteQuerySettings;
class BulkUpsertSettings extends OperationParamsSettings {
}
exports.BulkUpsertSettings = BulkUpsertSettings;
class ReadTableSettings {
    columns;
    ordered;
    rowLimit;
    keyRange;
    withRowLimit(rowLimit) {
        this.rowLimit = rowLimit;
        return this;
    }
    withColumns(...columns) {
        this.columns = columns;
        return this;
    }
    withOrdered(ordered) {
        this.ordered = ordered;
        return this;
    }
    withKeyRange(keyRange) {
        this.keyRange = keyRange;
        return this;
    }
    withKeyGreater(value) {
        this.getOrInitKeyRange().greater = value;
        return this;
    }
    withKeyGreaterOrEqual(value) {
        this.getOrInitKeyRange().greaterOrEqual = value;
        return this;
    }
    withKeyLess(value) {
        this.getOrInitKeyRange().less = value;
        return this;
    }
    withKeyLessOrEqual(value) {
        this.getOrInitKeyRange().lessOrEqual = value;
        return this;
    }
    getOrInitKeyRange() {
        if (!this.keyRange) {
            this.keyRange = {};
        }
        return this.keyRange;
    }
}
exports.ReadTableSettings = ReadTableSettings;
class ExecuteScanQuerySettings {
    mode;
    collectStats;
    withMode(mode) {
        this.mode = mode;
        return this;
    }
    withCollectStats(collectStats) {
        this.collectStats = collectStats;
        return this;
    }
}
exports.ExecuteScanQuerySettings = ExecuteScanQuerySettings;
class Session extends events_1.default {
    api;
    endpoint;
    sessionId;
    logger;
    getResponseMetadata;
    beingDeleted = false;
    free = true;
    closing = false;
    constructor(api, endpoint, sessionId, logger, getResponseMetadata) {
        super();
        this.api = api;
        this.endpoint = endpoint;
        this.sessionId = sessionId;
        this.logger = logger;
        this.getResponseMetadata = getResponseMetadata;
    }
    acquire() {
        this.free = false;
        this.logger.debug(`Acquired session ${this.sessionId} on endpoint ${this.endpoint.toString()}.`);
        return this;
    }
    release() {
        this.free = true;
        this.logger.debug(`Released session ${this.sessionId} on endpoint ${this.endpoint.toString()}.`);
        this.emit(SessionEvent.SESSION_RELEASE, this);
    }
    isFree() {
        return this.free && !this.isDeleted();
    }
    isClosing() {
        return this.closing;
    }
    isDeleted() {
        return this.beingDeleted;
    }
    async delete() {
        if (this.isDeleted()) {
            return Promise.resolve();
        }
        this.beingDeleted = true;
        (0, utils_1.ensureOperationSucceeded)(await this.api.deleteSession({ sessionId: this.sessionId }));
    }
    async keepAlive() {
        const request = { sessionId: this.sessionId };
        const response = await this.api.keepAlive(request);
        (0, utils_1.ensureOperationSucceeded)(this.processResponseMetadata(request, response));
    }
    async createTable(tablePath, description, settings) {
        const request = {
            ...description,
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await this.api.createTable(request);
        (0, utils_1.ensureOperationSucceeded)(this.processResponseMetadata(request, response));
    }
    async alterTable(tablePath, description, settings) {
        const request = {
            ...description,
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await this.api.alterTable(request);
        try {
            (0, utils_1.ensureOperationSucceeded)(this.processResponseMetadata(request, response));
        }
        catch (error) {
            // !! does not returns response status if async operation mode
            if (request.operationParams?.operationMode !== OperationMode.SYNC && error instanceof errors_1.MissingStatus)
                return;
            throw error;
        }
    }
    /*
     Drop table located at `tablePath` in the current database. By default dropping non-existent tables does not
     throw an error, to throw an error pass `new DropTableSettings({muteNonExistingTableErrors: true})` as 2nd argument.
     */
    async dropTable(tablePath, settings) {
        const request = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        settings = settings || new DropTableSettings();
        const suppressedErrors = settings?.muteNonExistingTableErrors ? [errors_1.SchemeError.status] : [];
        const response = await this.api.dropTable(request);
        (0, utils_1.ensureOperationSucceeded)(this.processResponseMetadata(request, response), suppressedErrors);
    }
    async describeTable(tablePath, settings) {
        const request = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
            operationParams: settings?.operationParams,
        };
        if (settings) {
            request.includeTableStats = settings.includeTableStats;
            request.includeShardKeyBounds = settings.includeShardKeyBounds;
            request.includePartitionStats = settings.includePartitionStats;
            request.operationParams = settings.operationParams;
        }
        const response = await this.api.describeTable(request);
        const payload = (0, utils_1.getOperationPayload)(this.processResponseMetadata(request, response));
        return DescribeTableResult.decode(payload);
    }
    async describeTableOptions(settings) {
        const request = {
            operationParams: settings?.operationParams,
        };
        const response = await this.api.describeTableOptions(request);
        const payload = (0, utils_1.getOperationPayload)(this.processResponseMetadata(request, response));
        return ydb_sdk_proto_1.Ydb.Table.DescribeTableOptionsResult.decode(payload);
    }
    async beginTransaction(txSettings, settings) {
        const request = {
            sessionId: this.sessionId,
            txSettings,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await this.api.beginTransaction(request);
        const payload = (0, utils_1.getOperationPayload)(this.processResponseMetadata(request, response));
        const { txMeta } = BeginTransactionResult.decode(payload);
        if (txMeta) {
            return txMeta;
        }
        throw new Error('Could not begin new transaction, txMeta is empty!');
    }
    async commitTransaction(txControl, settings) {
        const request = {
            sessionId: this.sessionId,
            txId: txControl.txId,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
            request.collectStats = settings.collectStats;
        }
        const response = await this.api.commitTransaction(request);
        (0, utils_1.ensureOperationSucceeded)(this.processResponseMetadata(request, response));
    }
    async rollbackTransaction(txControl, settings) {
        const request = {
            sessionId: this.sessionId,
            txId: txControl.txId,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await this.api.rollbackTransaction(request);
        (0, utils_1.ensureOperationSucceeded)(this.processResponseMetadata(request, response));
    }
    async prepareQuery(queryText, settings) {
        const request = {
            sessionId: this.sessionId,
            yqlText: queryText,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await this.api.prepareDataQuery(request);
        const payload = (0, utils_1.getOperationPayload)(this.processResponseMetadata(request, response));
        return PrepareQueryResult.decode(payload);
    }
    async executeQuery(query, params = {}, txControl = exports.AUTO_TX, settings) {
        this.logger.trace('preparedQuery %o', query);
        this.logger.trace('parameters %o', params);
        let queryToExecute;
        let keepInCache = false;
        if (typeof query === 'string') {
            queryToExecute = {
                yqlText: query
            };
            if (settings?.keepInCache !== undefined) {
                keepInCache = settings.keepInCache;
            }
        }
        else {
            queryToExecute = {
                id: query.queryId
            };
        }
        const request = {
            sessionId: this.sessionId,
            txControl,
            parameters: params,
            query: queryToExecute,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
            request.collectStats = settings.collectStats;
        }
        if (keepInCache) {
            request.queryCachePolicy = { keepInCache };
        }
        const response = await this.api.executeDataQuery(request);
        const payload = (0, utils_1.getOperationPayload)(this.processResponseMetadata(request, response, settings?.onResponseMetadata));
        return ExecuteQueryResult.decode(payload);
    }
    processResponseMetadata(request, response, onResponseMetadata) {
        const metadata = this.getResponseMetadata(request);
        if (metadata) {
            const serverHints = metadata.get(constants_1.ResponseMetadataKeys.ServerHints) || [];
            if (serverHints.includes('session-close')) {
                this.closing = true;
            }
            onResponseMetadata?.(metadata);
        }
        return response;
    }
    async bulkUpsert(tablePath, rows, settings) {
        const request = {
            table: `${this.endpoint.database}/${tablePath}`,
            rows,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await this.api.bulkUpsert(request);
        const payload = (0, utils_1.getOperationPayload)(this.processResponseMetadata(request, response));
        return BulkUpsertResult.decode(payload);
    }
    async streamReadTable(tablePath, consumer, settings) {
        const request = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
        };
        if (settings) {
            request.columns = settings.columns;
            request.ordered = settings.ordered;
            request.rowLimit = settings.rowLimit;
            request.keyRange = settings.keyRange;
        }
        return this.executeStreamRequest(request, this.api.streamReadTable.bind(this.api), ydb_sdk_proto_1.Ydb.Table.ReadTableResult.create, consumer);
    }
    async streamExecuteScanQuery(query, consumer, params = {}, settings) {
        let queryToExecute;
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
        const request = {
            query: queryToExecute,
            parameters: params,
            mode: settings?.mode || ydb_sdk_proto_1.Ydb.Table.ExecuteScanQueryRequest.Mode.MODE_EXEC,
        };
        if (settings) {
            request.collectStats = settings.collectStats;
        }
        return this.executeStreamRequest(request, this.api.streamExecuteScanQuery.bind(this.api), ExecuteScanQueryPartialResult.create, consumer);
    }
    executeStreamRequest(request, apiStreamMethod, transformer, consumer) {
        return new Promise((resolve, reject) => {
            apiStreamMethod(request, (error, response) => {
                try {
                    if (error) {
                        if (error instanceof utils_1.StreamEnd) {
                            resolve();
                        }
                        else {
                            reject(error);
                        }
                    }
                    else if (response) {
                        const operation = {
                            status: response.status,
                            issues: response.issues,
                        };
                        errors_1.YdbError.checkStatus(operation);
                        if (!response.result) {
                            reject(new errors_1.MissingValue('Missing result value!'));
                            return;
                        }
                        const result = transformer(response.result);
                        consumer(result);
                    }
                }
                catch (e) {
                    reject(e);
                }
            });
        });
    }
    async explainQuery(query, operationParams) {
        const request = {
            sessionId: this.sessionId,
            yqlText: query,
            operationParams
        };
        const response = await this.api.explainDataQuery(request);
        const payload = (0, utils_1.getOperationPayload)(this.processResponseMetadata(request, response));
        return ExplainQueryResult.decode(payload);
    }
}
__decorate([
    (0, retries_1.retryable)(),
    utils_1.pessimizable
], Session.prototype, "delete", null);
__decorate([
    (0, retries_1.retryable)(),
    utils_1.pessimizable
], Session.prototype, "keepAlive", null);
__decorate([
    (0, retries_1.retryable)(),
    utils_1.pessimizable
], Session.prototype, "createTable", null);
__decorate([
    (0, retries_1.retryable)(),
    utils_1.pessimizable
], Session.prototype, "alterTable", null);
__decorate([
    (0, retries_1.retryable)(),
    utils_1.pessimizable
], Session.prototype, "dropTable", null);
__decorate([
    (0, retries_1.retryable)(),
    utils_1.pessimizable
], Session.prototype, "describeTable", null);
__decorate([
    (0, retries_1.retryable)(),
    utils_1.pessimizable
], Session.prototype, "describeTableOptions", null);
__decorate([
    (0, retries_1.retryable)(),
    utils_1.pessimizable
], Session.prototype, "beginTransaction", null);
__decorate([
    (0, retries_1.retryable)(),
    utils_1.pessimizable
], Session.prototype, "commitTransaction", null);
__decorate([
    (0, retries_1.retryable)(),
    utils_1.pessimizable
], Session.prototype, "rollbackTransaction", null);
__decorate([
    (0, retries_1.retryable)(),
    utils_1.pessimizable
], Session.prototype, "prepareQuery", null);
__decorate([
    utils_1.pessimizable
], Session.prototype, "executeQuery", null);
__decorate([
    utils_1.pessimizable
], Session.prototype, "bulkUpsert", null);
__decorate([
    utils_1.pessimizable
], Session.prototype, "streamReadTable", null);
__decorate([
    utils_1.pessimizable
], Session.prototype, "streamExecuteScanQuery", null);
exports.Session = Session;
class SessionPool extends events_1.default {
    database;
    authService;
    sslCredentials;
    clientOptions;
    minLimit;
    maxLimit;
    sessions;
    sessionCreators;
    discoveryService;
    newSessionsRequested;
    sessionsBeingDeleted;
    sessionKeepAliveId;
    logger;
    waiters = [];
    static SESSION_MIN_LIMIT = 5;
    static SESSION_MAX_LIMIT = 20;
    constructor(settings) {
        super();
        this.database = settings.database;
        this.authService = settings.authService;
        this.sslCredentials = settings.sslCredentials;
        this.clientOptions = settings.clientOptions;
        this.logger = settings.logger;
        const poolSettings = settings.poolSettings;
        this.minLimit = poolSettings?.minLimit || SessionPool.SESSION_MIN_LIMIT;
        this.maxLimit = poolSettings?.maxLimit || SessionPool.SESSION_MAX_LIMIT;
        this.sessions = new Set();
        this.newSessionsRequested = 0;
        this.sessionsBeingDeleted = 0;
        this.sessionKeepAliveId = this.initListeners(poolSettings?.keepAlivePeriod || constants_1.SESSION_KEEPALIVE_PERIOD);
        this.sessionCreators = new Map();
        this.discoveryService = settings.discoveryService;
        this.discoveryService.on(constants_1.Events.ENDPOINT_REMOVED, (endpoint) => {
            this.sessionCreators.delete(endpoint);
        });
        this.prepopulateSessions();
    }
    async destroy() {
        this.logger.debug('Destroying pool...');
        clearInterval(this.sessionKeepAliveId);
        await Promise.all(lodash_1.default.map([...this.sessions], (session) => this.deleteSession(session)));
        this.logger.debug('Pool has been destroyed.');
    }
    initListeners(keepAlivePeriod) {
        return setInterval(async () => Promise.all(lodash_1.default.map([...this.sessions], (session) => {
            return session.keepAlive()
                // delete session if error
                .catch(() => this.deleteSession(session))
                // ignore errors to avoid UnhandledPromiseRejectionWarning
                .catch(() => Promise.resolve());
        })), keepAlivePeriod);
    }
    prepopulateSessions() {
        lodash_1.default.forEach(lodash_1.default.range(this.minLimit), () => this.createSession());
    }
    async getSessionCreator() {
        const endpoint = await this.discoveryService.getEndpoint();
        if (!this.sessionCreators.has(endpoint)) {
            const sessionService = new SessionService(endpoint, this.database, this.authService, this.logger, this.sslCredentials, this.clientOptions);
            this.sessionCreators.set(endpoint, sessionService);
        }
        return this.sessionCreators.get(endpoint);
    }
    maybeUseSession(session) {
        if (this.waiters.length > 0) {
            const waiter = this.waiters.shift();
            if (typeof waiter === "function") {
                waiter(session);
                return true;
            }
        }
        return false;
    }
    async createSession() {
        const sessionCreator = await this.getSessionCreator();
        const session = await sessionCreator.create();
        session.on(SessionEvent.SESSION_RELEASE, async () => {
            if (session.isClosing()) {
                await this.deleteSession(session);
            }
            else {
                this.maybeUseSession(session);
            }
        });
        session.on(SessionEvent.SESSION_BROKEN, async () => {
            await this.deleteSession(session);
        });
        this.sessions.add(session);
        return session;
    }
    deleteSession(session) {
        if (session.isDeleted()) {
            return Promise.resolve();
        }
        this.sessionsBeingDeleted++;
        // acquire new session as soon one of existing ones is deleted
        if (this.waiters.length > 0) {
            this.acquire().then((session) => {
                if (!this.maybeUseSession(session)) {
                    session.release();
                }
            });
        }
        return session.delete()
            // delete session in any case
            .finally(() => {
            this.sessions.delete(session);
            this.sessionsBeingDeleted--;
        });
    }
    acquire(timeout = 0) {
        for (const session of this.sessions) {
            if (session.isFree()) {
                return Promise.resolve(session.acquire());
            }
        }
        if (this.sessions.size + this.newSessionsRequested - this.sessionsBeingDeleted <= this.maxLimit) {
            this.newSessionsRequested++;
            return this.createSession()
                .then((session) => {
                return session.acquire();
            })
                .finally(() => {
                this.newSessionsRequested--;
            });
        }
        else {
            return new Promise((resolve, reject) => {
                let timeoutId;
                function waiter(session) {
                    clearTimeout(timeoutId);
                    resolve(session.acquire());
                }
                if (timeout) {
                    timeoutId = setTimeout(() => {
                        this.waiters.splice(this.waiters.indexOf(waiter), 1);
                        reject(new errors_1.SessionPoolEmpty(`No session became available within timeout of ${timeout} ms`));
                    }, timeout);
                }
                this.waiters.push(waiter);
            });
        }
    }
    async _withSession(session, callback, maxRetries = 0) {
        try {
            const result = await callback(session);
            session.release();
            return result;
        }
        catch (error) {
            if (error instanceof errors_1.BadSession || error instanceof errors_1.SessionBusy) {
                this.logger.debug('Encountered bad or busy session, re-creating the session');
                session.emit(SessionEvent.SESSION_BROKEN);
                session = await this.createSession();
                if (maxRetries > 0) {
                    this.logger.debug(`Re-running operation in new session, ${maxRetries} left.`);
                    session.acquire();
                    return this._withSession(session, callback, maxRetries - 1);
                }
            }
            else {
                session.release();
            }
            throw error;
        }
    }
    async withSession(callback, timeout = 0) {
        const session = await this.acquire(timeout);
        return this._withSession(session, callback);
    }
    async withSessionRetry(callback, timeout = 0, maxRetries = 10) {
        const session = await this.acquire(timeout);
        return this._withSession(session, callback, maxRetries);
    }
}
exports.SessionPool = SessionPool;
class TableClient extends events_1.default {
    pool;
    constructor(settings) {
        super();
        this.pool = new SessionPool(settings);
    }
    async withSession(callback, timeout = 0) {
        return this.pool.withSession(callback, timeout);
    }
    async withSessionRetry(callback, timeout = 0, maxRetries = 10) {
        return this.pool.withSessionRetry(callback, timeout, maxRetries);
    }
    async destroy() {
        await this.pool.destroy();
    }
}
exports.TableClient = TableClient;
class Column {
    name;
    type;
    family;
    constructor(name, type, family) {
        this.name = name;
        this.type = type;
        this.family = family;
    }
}
exports.Column = Column;
class StorageSettings {
    media;
    constructor(media) {
        this.media = media;
    }
}
exports.StorageSettings = StorageSettings;
class ColumnFamilyPolicy {
    name;
    data;
    external;
    keepInMemory;
    compression;
    withName(name) {
        this.name = name;
        return this;
    }
    withData(data) {
        this.data = data;
        return this;
    }
    withExternal(external) {
        this.external = external;
        return this;
    }
    withKeepInMemory(keepInMemory) {
        this.keepInMemory = keepInMemory;
        return this;
    }
    withCompression(compression) {
        this.compression = compression;
        return this;
    }
}
exports.ColumnFamilyPolicy = ColumnFamilyPolicy;
class StoragePolicy {
    presetName;
    syslog;
    log;
    data;
    external;
    keepInMemory;
    columnFamilies = [];
    withPresetName(presetName) {
        this.presetName = presetName;
        return this;
    }
    withSyslog(syslog) {
        this.syslog = syslog;
        return this;
    }
    withLog(log) {
        this.log = log;
        return this;
    }
    withData(data) {
        this.data = data;
        return this;
    }
    withExternal(external) {
        this.external = external;
        return this;
    }
    withKeepInMemory(keepInMemory) {
        this.keepInMemory = keepInMemory;
        return this;
    }
    withColumnFamilies(...columnFamilies) {
        for (const policy of columnFamilies) {
            this.columnFamilies.push(policy);
        }
        return this;
    }
}
exports.StoragePolicy = StoragePolicy;
class ExplicitPartitions {
    splitPoints;
    constructor(splitPoints) {
        this.splitPoints = splitPoints;
    }
}
exports.ExplicitPartitions = ExplicitPartitions;
class PartitioningPolicy {
    presetName;
    autoPartitioning;
    uniformPartitions;
    explicitPartitions;
    withPresetName(presetName) {
        this.presetName = presetName;
        return this;
    }
    withUniformPartitions(uniformPartitions) {
        this.uniformPartitions = uniformPartitions;
        return this;
    }
    withAutoPartitioning(autoPartitioning) {
        this.autoPartitioning = autoPartitioning;
        return this;
    }
    withExplicitPartitions(explicitPartitions) {
        this.explicitPartitions = explicitPartitions;
        return this;
    }
}
exports.PartitioningPolicy = PartitioningPolicy;
class ReplicationPolicy {
    presetName;
    replicasCount;
    createPerAvailabilityZone;
    allowPromotion;
    withPresetName(presetName) {
        this.presetName = presetName;
        return this;
    }
    withReplicasCount(replicasCount) {
        this.replicasCount = replicasCount;
        return this;
    }
    withCreatePerAvailabilityZone(createPerAvailabilityZone) {
        this.createPerAvailabilityZone = createPerAvailabilityZone;
        return this;
    }
    withAllowPromotion(allowPromotion) {
        this.allowPromotion = allowPromotion;
        return this;
    }
}
exports.ReplicationPolicy = ReplicationPolicy;
class CompactionPolicy {
    presetName;
    constructor(presetName) {
        this.presetName = presetName;
    }
}
exports.CompactionPolicy = CompactionPolicy;
class ExecutionPolicy {
    presetName;
    constructor(presetName) {
        this.presetName = presetName;
    }
}
exports.ExecutionPolicy = ExecutionPolicy;
class CachingPolicy {
    presetName;
    constructor(presetName) {
        this.presetName = presetName;
    }
}
exports.CachingPolicy = CachingPolicy;
class TableProfile {
    presetName;
    storagePolicy;
    compactionPolicy;
    partitioningPolicy;
    executionPolicy;
    replicationPolicy;
    cachingPolicy;
    withPresetName(presetName) {
        this.presetName = presetName;
        return this;
    }
    withStoragePolicy(storagePolicy) {
        this.storagePolicy = storagePolicy;
        return this;
    }
    withCompactionPolicy(compactionPolicy) {
        this.compactionPolicy = compactionPolicy;
        return this;
    }
    withPartitioningPolicy(partitioningPolicy) {
        this.partitioningPolicy = partitioningPolicy;
        return this;
    }
    withExecutionPolicy(executionPolicy) {
        this.executionPolicy = executionPolicy;
        return this;
    }
    withReplicationPolicy(replicationPolicy) {
        this.replicationPolicy = replicationPolicy;
        return this;
    }
    withCachingPolicy(cachingPolicy) {
        this.cachingPolicy = cachingPolicy;
        return this;
    }
}
exports.TableProfile = TableProfile;
class TableIndex {
    name;
    indexColumns = [];
    dataColumns = null;
    globalIndex = null;
    globalAsyncIndex = null;
    constructor(name) {
        this.name = name;
    }
    withIndexColumns(...indexColumns) {
        this.indexColumns.push(...indexColumns);
        return this;
    }
    /** Adds [covering index](https://ydb.tech/en/docs/concepts/secondary_indexes#covering) over columns */
    withDataColumns(...dataColumns) {
        if (!this.dataColumns)
            this.dataColumns = [];
        this.dataColumns?.push(...dataColumns);
        return this;
    }
    withGlobalAsync(isAsync) {
        if (isAsync) {
            this.globalAsyncIndex = new ydb_sdk_proto_1.Ydb.Table.GlobalAsyncIndex();
            this.globalIndex = null;
        }
        else {
            this.globalAsyncIndex = null;
            this.globalIndex = new ydb_sdk_proto_1.Ydb.Table.GlobalIndex();
        }
        return this;
    }
}
exports.TableIndex = TableIndex;
class TtlSettings {
    dateTypeColumn;
    constructor(columnName, expireAfterSeconds = 0) {
        this.dateTypeColumn = { columnName, expireAfterSeconds };
    }
}
exports.TtlSettings = TtlSettings;
class TableDescription {
    columns;
    primaryKey;
    /** @deprecated use TableDescription options instead */
    profile;
    indexes = [];
    ttlSettings;
    partitioningSettings;
    uniformPartitions;
    columnFamilies;
    attributes;
    compactionPolicy;
    keyBloomFilter;
    partitionAtKeys;
    readReplicasSettings;
    storageSettings;
    // path and operationPrams defined in createTable,
    // columns and primaryKey are in constructor
    constructor(columns = [], primaryKey = []) {
        this.columns = columns;
        this.primaryKey = primaryKey;
    }
    withColumn(column) {
        this.columns.push(column);
        return this;
    }
    withColumns(...columns) {
        for (const column of columns) {
            this.columns.push(column);
        }
        return this;
    }
    withPrimaryKey(key) {
        this.primaryKey.push(key);
        return this;
    }
    withPrimaryKeys(...keys) {
        for (const key of keys) {
            this.primaryKey.push(key);
        }
        return this;
    }
    /** @deprecated use TableDescription options instead */
    withProfile(profile) {
        this.profile = profile;
        return this;
    }
    withIndex(index) {
        this.indexes.push(index);
        return this;
    }
    withIndexes(...indexes) {
        for (const index of indexes) {
            this.indexes.push(index);
        }
        return this;
    }
    withTtl(columnName, expireAfterSeconds = 0) {
        this.ttlSettings = new TtlSettings(columnName, expireAfterSeconds);
        return this;
    }
    withPartitioningSettings(partitioningSettings) {
        this.partitioningSettings = partitioningSettings;
    }
}
exports.TableDescription = TableDescription;
class AlterTableDescription {
    addColumns = [];
    dropColumns = [];
    alterColumns = [];
    setTtlSettings;
    dropTtlSettings;
    addIndexes = [];
    dropIndexes = [];
    alterStorageSettings;
    addColumnFamilies;
    alterColumnFamilies;
    alterAttributes;
    setCompactionPolicy;
    alterPartitioningSettings;
    setKeyBloomFilter;
    setReadReplicasSettings;
    addChangefeeds;
    dropChangefeeds;
    renameIndexes;
    constructor() { }
    withAddColumn(column) {
        this.addColumns.push(column);
        return this;
    }
    withDropColumn(columnName) {
        this.dropColumns.push(columnName);
        return this;
    }
    withAlterColumn(column) {
        this.alterColumns.push(column);
        return this;
    }
    withSetTtl(columnName, expireAfterSeconds = 0) {
        this.setTtlSettings = new TtlSettings(columnName, expireAfterSeconds);
        return this;
    }
    withDropTtl() {
        this.dropTtlSettings = {};
        return this;
    }
}
exports.AlterTableDescription = AlterTableDescription;
