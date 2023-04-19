import _ from 'lodash';
import EventEmitter from 'events';
import * as grpc from '@grpc/grpc-js';
import {google, Ydb} from 'ydb-sdk-proto';
import {
    AuthenticatedService,
    ClientOptions,
    StreamEnd,
    ensureOperationSucceeded,
    getOperationPayload,
    pessimizable, AsyncResponse
} from './utils';
import DiscoveryService, {Endpoint} from './discovery';
import {IPoolSettings} from './driver';
import {ISslCredentials} from './ssl-credentials';
import {Events, ResponseMetadataKeys, SESSION_KEEPALIVE_PERIOD} from './constants';
import {IAuthService} from './credentials';
// noinspection ES6PreferShortImport
import {Logger} from './logging';
import {retryable} from './retries';
import {
    SchemeError,
    SessionPoolEmpty,
    BadSession,
    SessionBusy,
    MissingValue,
    YdbError,
    MissingStatus
} from './errors';

import TableService = Ydb.Table.V1.TableService;
import CreateSessionRequest = Ydb.Table.CreateSessionRequest;
import ICreateSessionResult = Ydb.Table.ICreateSessionResult;
import CreateSessionResult = Ydb.Table.CreateSessionResult;
import IQuery = Ydb.Table.IQuery;
import IType = Ydb.IType;
import DescribeTableResult = Ydb.Table.DescribeTableResult;
import PrepareQueryResult = Ydb.Table.PrepareQueryResult;
import ExecuteQueryResult = Ydb.Table.ExecuteQueryResult;
import ITransactionSettings = Ydb.Table.ITransactionSettings;
import BeginTransactionResult = Ydb.Table.BeginTransactionResult;
import ITransactionMeta = Ydb.Table.ITransactionMeta;
import AutoPartitioningPolicy = Ydb.Table.PartitioningPolicy.AutoPartitioningPolicy;
import ITypedValue = Ydb.ITypedValue;
import FeatureFlag = Ydb.FeatureFlag.Status;
import Compression = Ydb.Table.ColumnFamilyPolicy.Compression;
import ExecuteScanQueryPartialResult = Ydb.Table.ExecuteScanQueryPartialResult;
import IKeyRange = Ydb.Table.IKeyRange;
import TypedValue = Ydb.TypedValue;
import BulkUpsertResult = Ydb.Table.BulkUpsertResult;
import OperationMode = Ydb.Operations.OperationParams.OperationMode;

interface PartialResponse<T> {
    status?: (Ydb.StatusIds.StatusCode|null);
    issues?: (Ydb.Issue.IIssueMessage[]|null);
    result?: (T|null);
}

export class SessionService extends AuthenticatedService<TableService> {
    public endpoint: Endpoint;
    private readonly logger: Logger;

    constructor(endpoint: Endpoint, database: string, authService: IAuthService, logger: Logger, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions) {
        const host = endpoint.toString();
        super(host, database, 'Ydb.Table.V1.TableService', TableService, authService, sslCredentials, clientOptions);
        this.endpoint = endpoint;
        this.logger = logger;
    }

    @retryable()
    @pessimizable
    async create(): Promise<Session> {
        const response = await this.api.createSession(CreateSessionRequest.create());
        const payload = getOperationPayload(response);
        const {sessionId} = CreateSessionResult.decode(payload);
        return new Session(this.api, this.endpoint, sessionId, this.logger, this.getResponseMetadata.bind(this));
    }
}

enum SessionEvent {
    SESSION_RELEASE = 'SESSION_RELEASE',
    SESSION_BROKEN = 'SESSION_BROKEN'
}

interface IExistingTransaction {
    txId: string
}
interface INewTransaction {
    beginTx: ITransactionSettings,
    commitTx: boolean
}

export const AUTO_TX: INewTransaction = {
    beginTx: {
        serializableReadWrite: {}
    },
    commitTx: true
};

interface IQueryParams {
    [k: string]: Ydb.ITypedValue
}

export class OperationParams implements Ydb.Operations.IOperationParams {
    operationMode?: OperationMode;
    operationTimeout?: google.protobuf.IDuration;
    cancelAfter?: google.protobuf.IDuration;
    labels?: { [k: string]: string };
    reportCostInfo?: Ydb.FeatureFlag.Status;

    withSyncMode() {
        this.operationMode = OperationMode.SYNC;
        return this;
    }

    withAsyncMode() {
        this.operationMode = OperationMode.ASYNC;
        return this;
    }

    withOperationTimeout(duration: google.protobuf.IDuration) {
        this.operationTimeout = duration;
        return this;
    }

    withOperationTimeoutSeconds(seconds: number) {
        this.operationTimeout = {seconds};
        return this;
    }

    withCancelAfter(duration: google.protobuf.IDuration) {
        this.cancelAfter = duration;
        return this;
    }

    withCancelAfterSeconds(seconds: number) {
        this.cancelAfter = {seconds};
        return this;
    }

    withLabels(labels: {[k: string]: string}) {
        this.labels = labels;
        return this;
    }

    withReportCostInfo() {
        this.reportCostInfo = Ydb.FeatureFlag.Status.ENABLED;
        return this;
    }
}

export class OperationParamsSettings {
    operationParams?: OperationParams;

    withOperationParams(operationParams: OperationParams) {
        this.operationParams = operationParams;
        return this;
    }
}

export class CreateTableSettings extends OperationParamsSettings {
}

export class AlterTableSettings extends OperationParamsSettings {
}

interface IDropTableSettings {
    muteNonExistingTableErrors: boolean;
}
export class DropTableSettings extends OperationParamsSettings {
    muteNonExistingTableErrors: boolean;

    constructor({muteNonExistingTableErrors = true} = {} as IDropTableSettings) {
        super();
        this.muteNonExistingTableErrors = muteNonExistingTableErrors;
    }
}

export class DescribeTableSettings extends OperationParamsSettings {
    includeShardKeyBounds?: boolean;
    includeTableStats?: boolean;
    includePartitionStats?: boolean;

    withIncludeShardKeyBounds(includeShardKeyBounds: boolean) {
        this.includeShardKeyBounds = includeShardKeyBounds;
        return this;
    }

    withIncludeTableStats(includeTableStats: boolean) {
        this.includeTableStats = includeTableStats;
        return this;
    }

    withIncludePartitionStats(includePartitionStats: boolean) {
        this.includePartitionStats = includePartitionStats;
        return this;
    }
}

export class BeginTransactionSettings extends OperationParamsSettings {
}

export class CommitTransactionSettings extends OperationParamsSettings {
    collectStats?: Ydb.Table.QueryStatsCollection.Mode;

    withCollectStats(collectStats: Ydb.Table.QueryStatsCollection.Mode) {
        this.collectStats = collectStats;
        return this;
    }
}

export class RollbackTransactionSettings extends OperationParamsSettings {
}

export class PrepareQuerySettings extends OperationParamsSettings {
}

export class ExecuteQuerySettings extends OperationParamsSettings {
    keepInCache: boolean = false;
    collectStats?: Ydb.Table.QueryStatsCollection.Mode;
    onResponseMetadata?: (metadata: grpc.Metadata) => void;

    withKeepInCache(keepInCache: boolean) {
        this.keepInCache = keepInCache;
        return this;
    }

    withCollectStats(collectStats: Ydb.Table.QueryStatsCollection.Mode) {
        this.collectStats = collectStats;
        return this;
    }
}

export class BulkUpsertSettings extends OperationParamsSettings {
}

export class ReadTableSettings {
    columns?: string[];
    ordered?: boolean;
    rowLimit?: number;
    keyRange?: Ydb.Table.IKeyRange;

    withRowLimit(rowLimit: number) {
        this.rowLimit = rowLimit;
        return this;
    }

    withColumns(...columns: string[]) {
        this.columns = columns;
        return this;
    }

    withOrdered(ordered: boolean) {
        this.ordered = ordered;
        return this;
    }

    withKeyRange(keyRange: IKeyRange) {
        this.keyRange = keyRange;
        return this;
    }

    withKeyGreater(value: ITypedValue) {
        this.getOrInitKeyRange().greater = value;
        return this;
    }

    withKeyGreaterOrEqual(value: ITypedValue) {
        this.getOrInitKeyRange().greaterOrEqual = value;
        return this;
    }

    withKeyLess(value: ITypedValue) {
        this.getOrInitKeyRange().less = value;
        return this;
    }

    withKeyLessOrEqual(value: ITypedValue) {
        this.getOrInitKeyRange().lessOrEqual = value;
        return this;
    }

    private getOrInitKeyRange() {
        if (!this.keyRange) {
            this.keyRange = {};
        }
        return this.keyRange;
    }
}

export class ExecuteScanQuerySettings {
    mode?: Ydb.Table.ExecuteScanQueryRequest.Mode;
    collectStats?: Ydb.Table.QueryStatsCollection.Mode;

    withMode(mode: Ydb.Table.ExecuteScanQueryRequest.Mode) {
        this.mode = mode;
        return this;
    }

    withCollectStats(collectStats: Ydb.Table.QueryStatsCollection.Mode) {
        this.collectStats = collectStats;
        return this;
    }
}

export class Session extends EventEmitter implements ICreateSessionResult {
    private beingDeleted = false;
    private free = true;
    private closing = false;

    constructor(
        private api: TableService,
        public endpoint: Endpoint,
        public sessionId: string,
        private logger: Logger,
        private getResponseMetadata: (request: object) => grpc.Metadata | undefined
    ) {
        super();
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

    public isFree() {
        return this.free && !this.isDeleted();
    }
    public isClosing() {
        return this.closing;
    }
    public isDeleted() {
        return this.beingDeleted;
    }

    @retryable()
    @pessimizable
    public async delete(): Promise<void> {
        if (this.isDeleted()) {
            return Promise.resolve();
        }
        this.beingDeleted = true;
        ensureOperationSucceeded(await this.api.deleteSession({sessionId: this.sessionId}));
    }

    @retryable()
    @pessimizable
    public async keepAlive(): Promise<void> {
        const request = {sessionId: this.sessionId};
        const response = await this.api.keepAlive(request);
        ensureOperationSucceeded(this.processResponseMetadata(request, response));
    }

    @retryable()
    @pessimizable
    public async createTable(tablePath: string, description: TableDescription, settings?: CreateTableSettings): Promise<void> {
        const {columns, primaryKey, indexes, profile, ttlSettings} = description;
        const request: Ydb.Table.ICreateTableRequest = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
            columns,
            primaryKey,
            indexes,
            profile,
            ttlSettings,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await this.api.createTable(request);
        ensureOperationSucceeded(this.processResponseMetadata(request, response));
    }

    @retryable()
    @pessimizable
    public async alterTable(
        tablePath: string,
        description: AlterTableDescription,
        settings?: AlterTableSettings
    ): Promise<void> {
        const request: Ydb.Table.IAlterTableRequest = {
            ...description,
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }

        const response = await this.api.alterTable(request);
        try {
            ensureOperationSucceeded(this.processResponseMetadata(request, response));
        } catch (error) {
            // !! does not returns response status if async operation mode
            if (request.operationParams?.operationMode !== OperationMode.SYNC && error instanceof MissingStatus) return;
            throw error;
        }
    }

    /*
     Drop table located at `tablePath` in the current database. By default dropping non-existent tables does not
     throw an error, to throw an error pass `new DropTableSettings({muteNonExistingTableErrors: true})` as 2nd argument.
     */
    @retryable()
    @pessimizable
    public async dropTable(tablePath: string, settings?: DropTableSettings): Promise<void> {
        const request: Ydb.Table.IDropTableRequest = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        settings = settings || new DropTableSettings();
        const suppressedErrors = settings?.muteNonExistingTableErrors ? [SchemeError.status] : [];
        const response = await this.api.dropTable(request);
        ensureOperationSucceeded(this.processResponseMetadata(request, response), suppressedErrors);
    }

    @retryable()
    @pessimizable
    public async describeTable(tablePath: string, settings?: DescribeTableSettings): Promise<DescribeTableResult> {
        const request: Ydb.Table.IDescribeTableRequest = {
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
        const payload = getOperationPayload(this.processResponseMetadata(request, response));
        return DescribeTableResult.decode(payload);
    }

    @retryable()
    @pessimizable
    public async describeTableOptions(
        settings?: DescribeTableSettings,
    ): Promise<Ydb.Table.DescribeTableOptionsResult> {
        const request: Ydb.Table.IDescribeTableOptionsRequest = {
            operationParams: settings?.operationParams,
        };

        const response = await this.api.describeTableOptions(request);
        const payload = getOperationPayload(this.processResponseMetadata(request, response));
        return Ydb.Table.DescribeTableOptionsResult.decode(payload);
    }

    @retryable()
    @pessimizable
    public async beginTransaction(
        txSettings: ITransactionSettings,
        settings?: BeginTransactionSettings,
    ): Promise<ITransactionMeta> {
        const request: Ydb.Table.IBeginTransactionRequest = {
            sessionId: this.sessionId,
            txSettings,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await this.api.beginTransaction(request);
        const payload = getOperationPayload(this.processResponseMetadata(request, response));
        const {txMeta} = BeginTransactionResult.decode(payload);
        if (txMeta) {
            return txMeta;
        }
        throw new Error('Could not begin new transaction, txMeta is empty!');
    }

    @retryable()
    @pessimizable
    public async commitTransaction(txControl: IExistingTransaction, settings?: CommitTransactionSettings): Promise<void> {
        const request: Ydb.Table.ICommitTransactionRequest = {
            sessionId: this.sessionId,
            txId: txControl.txId,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
            request.collectStats = settings.collectStats;
        }
        const response = await this.api.commitTransaction(request);
        ensureOperationSucceeded(this.processResponseMetadata(request, response));
    }

    @retryable()
    @pessimizable
    public async rollbackTransaction(txControl: IExistingTransaction, settings?: RollbackTransactionSettings): Promise<void> {
        const request: Ydb.Table.IRollbackTransactionRequest = {
            sessionId: this.sessionId,
            txId: txControl.txId,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await this.api.rollbackTransaction(request);
        ensureOperationSucceeded(this.processResponseMetadata(request, response));
    }

    @retryable()
    @pessimizable
    public async prepareQuery(queryText: string, settings?: PrepareQuerySettings): Promise<PrepareQueryResult> {
        const request: Ydb.Table.IPrepareDataQueryRequest = {
            sessionId: this.sessionId,
            yqlText: queryText,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await this.api.prepareDataQuery(request);
        const payload = getOperationPayload(this.processResponseMetadata(request, response));
        return PrepareQueryResult.decode(payload);
    }

    @pessimizable
    public async executeQuery(
        query: PrepareQueryResult | string,
        params: IQueryParams = {},
        txControl: IExistingTransaction | INewTransaction = AUTO_TX,
        settings?: ExecuteQuerySettings,
    ): Promise<ExecuteQueryResult> {
        this.logger.trace('preparedQuery %o', query);
        this.logger.trace('parameters %o', params);
        let queryToExecute: IQuery;
        let keepInCache = false;
        if (typeof query === 'string') {
            queryToExecute = {
                yqlText: query
            };
            if (settings?.keepInCache !== undefined) {
                keepInCache = settings.keepInCache;
            }
        } else {
            queryToExecute = {
                id: query.queryId
            };
        }
        const request: Ydb.Table.IExecuteDataQueryRequest = {
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
            request.queryCachePolicy = {keepInCache};
        }
        const response = await this.api.executeDataQuery(request);
        const payload = getOperationPayload(this.processResponseMetadata(request, response, settings?.onResponseMetadata));
        return ExecuteQueryResult.decode(payload);
    }

    private processResponseMetadata(
        request: object,
        response: AsyncResponse,
        onResponseMetadata?: (metadata: grpc.Metadata) => void
    ) {
        const metadata = this.getResponseMetadata(request);
        if (metadata) {
            const serverHints = metadata.get(ResponseMetadataKeys.ServerHints) || [];
            if (serverHints.includes('session-close')) {
                this.closing = true;
            }
            onResponseMetadata?.(metadata);
        }
        return response;
    }

    @pessimizable
    public async bulkUpsert(tablePath: string, rows: TypedValue, settings?: BulkUpsertSettings) {
        const request: Ydb.Table.IBulkUpsertRequest = {
            table: `${this.endpoint.database}/${tablePath}`,
            rows,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await this.api.bulkUpsert(request);
        const payload = getOperationPayload(this.processResponseMetadata(request, response));
        return BulkUpsertResult.decode(payload);
    }

    @pessimizable
    public async streamReadTable(
        tablePath: string,
        consumer: (result: Ydb.Table.ReadTableResult) => void,
        settings?: ReadTableSettings): Promise<void> {
        const request: Ydb.Table.IReadTableRequest = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
        };
        if (settings) {
            request.columns = settings.columns;
            request.ordered = settings.ordered;
            request.rowLimit = settings.rowLimit;
            request.keyRange = settings.keyRange;
        }

        return this.executeStreamRequest(
            request,
            this.api.streamReadTable.bind(this.api),
            Ydb.Table.ReadTableResult.create,
            consumer);
    }

    @pessimizable
    public async streamExecuteScanQuery(
        query: PrepareQueryResult | string,
        consumer: (result: ExecuteScanQueryPartialResult) => void,
        params: IQueryParams = {},
        settings?: ExecuteScanQuerySettings): Promise<void> {
        let queryToExecute: IQuery;
        if (typeof query === 'string') {
            queryToExecute = {
                yqlText: query
            };
        } else {
            queryToExecute = {
                id: query.queryId
            };
        }

        const request: Ydb.Table.IExecuteScanQueryRequest = {
            query: queryToExecute,
            parameters: params,
            mode: settings?.mode || Ydb.Table.ExecuteScanQueryRequest.Mode.MODE_EXEC,
        };

        if (settings) {
            request.collectStats = settings.collectStats;
        }

        return this.executeStreamRequest(
            request,
            this.api.streamExecuteScanQuery.bind(this.api),
            ExecuteScanQueryPartialResult.create,
            consumer);
    }

    private executeStreamRequest<Req, Resp extends PartialResponse<IRes>, IRes, Res>(
        request: Req,
        apiStreamMethod: (request: Req, callback: (error: (Error|null), response?: Resp) => void) => void,
        transformer: (result: IRes) => Res,
        consumer: (result: Res) => void)
        : Promise<void> {
        return new Promise((resolve, reject) => {
            apiStreamMethod(request, (error, response) => {
                try {
                    if (error) {
                        if (error instanceof StreamEnd) {
                            resolve();
                        } else {
                            reject(error);
                        }
                    } else if (response) {
                        const operation = {
                            status: response.status,
                            issues: response.issues,
                        } as Ydb.Operations.IOperation;
                        YdbError.checkStatus(operation);

                        if (!response.result) {
                            reject(new MissingValue('Missing result value!'));
                            return;
                        }

                        const result = transformer(response.result);
                        consumer(result);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
}

type SessionCallback<T> = (session: Session) => Promise<T>;

interface ITableClientSettings {
    database: string;
    authService: IAuthService;
    sslCredentials?: ISslCredentials;
    poolSettings?: IPoolSettings;
    clientOptions?: ClientOptions;
    discoveryService: DiscoveryService;
    logger: Logger;
}

export class SessionPool extends EventEmitter {
    private readonly database: string;
    private readonly authService: IAuthService;
    private readonly sslCredentials?: ISslCredentials;
    private readonly clientOptions?: ClientOptions;
    private readonly minLimit: number;
    private readonly maxLimit: number;
    private readonly sessions: Set<Session>;
    private readonly sessionCreators: Map<Endpoint, SessionService>;
    private readonly discoveryService: DiscoveryService;
    private newSessionsRequested: number;
    private sessionsBeingDeleted: number;
    private readonly sessionKeepAliveId: NodeJS.Timeout;
    private readonly logger: Logger;
    private readonly waiters: ((session: Session) => void)[] = [];

    private static SESSION_MIN_LIMIT = 5;
    private static SESSION_MAX_LIMIT = 20;

    constructor(settings: ITableClientSettings) {
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
        this.sessionKeepAliveId = this.initListeners(poolSettings?.keepAlivePeriod || SESSION_KEEPALIVE_PERIOD);
        this.sessionCreators = new Map();
        this.discoveryService = settings.discoveryService;
        this.discoveryService.on(Events.ENDPOINT_REMOVED, (endpoint: Endpoint) => {
            this.sessionCreators.delete(endpoint);
        });
        this.prepopulateSessions();
    }

    public async destroy(): Promise<void> {
        this.logger.debug('Destroying pool...');
        clearInterval(this.sessionKeepAliveId);
        await Promise.all(_.map([...this.sessions], (session: Session) => this.deleteSession(session)));
        this.logger.debug('Pool has been destroyed.');
    }

    private initListeners(keepAlivePeriod: number) {
        return setInterval(async () => Promise.all(
            _.map([...this.sessions], (session: Session) => {
                return session.keepAlive()
                    // delete session if error
                    .catch(() => this.deleteSession(session))
                    // ignore errors to avoid UnhandledPromiseRejectionWarning
                    .catch(() => Promise.resolve())
            })
        ), keepAlivePeriod);
    }

    private prepopulateSessions() {
        _.forEach(_.range(this.minLimit), () => this.createSession());
    }

    private async getSessionCreator(): Promise<SessionService> {
        const endpoint = await this.discoveryService.getEndpoint();
        if (!this.sessionCreators.has(endpoint)) {
            const sessionService = new SessionService(endpoint, this.database, this.authService, this.logger, this.sslCredentials, this.clientOptions);
            this.sessionCreators.set(endpoint, sessionService);
        }
        return this.sessionCreators.get(endpoint) as SessionService;
    }

    private maybeUseSession(session: Session) {
        if (this.waiters.length > 0) {
            const waiter = this.waiters.shift();
            if (typeof waiter === "function") {
                waiter(session);
                return true;
            }
        }
        return false;
    }

    private async createSession(): Promise<Session> {
        const sessionCreator = await this.getSessionCreator();
        const session = await sessionCreator.create();
        session.on(SessionEvent.SESSION_RELEASE, async () => {
            if (session.isClosing()) {
                await this.deleteSession(session);
            } else {
                this.maybeUseSession(session);
            }
        })
        session.on(SessionEvent.SESSION_BROKEN, async () => {
            await this.deleteSession(session);
        });
        this.sessions.add(session);
        return session;
    }

    private deleteSession(session: Session): Promise<void> {
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

    private acquire(timeout: number = 0): Promise<Session> {
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
        } else {
            return new Promise((resolve, reject) => {
                let timeoutId: NodeJS.Timeout;
                function waiter(session: Session) {
                    clearTimeout(timeoutId);
                    resolve(session.acquire());
                }
                if (timeout) {
                    timeoutId = setTimeout(() => {
                        this.waiters.splice(this.waiters.indexOf(waiter), 1);
                        reject(
                            new SessionPoolEmpty(`No session became available within timeout of ${timeout} ms`)
                        );
                    }, timeout);
                }
                this.waiters.push(waiter);
            });
        }
    }

    private async _withSession<T>(session: Session, callback: SessionCallback<T>, maxRetries = 0): Promise<T> {
        try {
            const result = await callback(session);
            session.release();
            return result;
        } catch (error) {
            if (error instanceof BadSession || error instanceof SessionBusy) {
                this.logger.debug('Encountered bad or busy session, re-creating the session');
                session.emit(SessionEvent.SESSION_BROKEN);
                session = await this.createSession();
                if (maxRetries > 0) {
                    this.logger.debug(`Re-running operation in new session, ${maxRetries} left.`);
                    session.acquire();
                    return this._withSession(session, callback, maxRetries - 1);
                }
            } else {
                session.release();
            }
            throw error;
        }
    }

    public async withSession<T>(callback: SessionCallback<T>, timeout: number = 0): Promise<T> {
        const session = await this.acquire(timeout);
        return this._withSession(session, callback);
    }

    public async withSessionRetry<T>(callback: SessionCallback<T>, timeout: number = 0, maxRetries = 10): Promise<T> {
        const session = await this.acquire(timeout);
        return this._withSession(session, callback, maxRetries);
    }
}

export class TableClient extends EventEmitter {
    private pool: SessionPool;

    constructor(settings: ITableClientSettings) {
        super();
        this.pool = new SessionPool(settings);
    }

    public async withSession<T>(callback: (session: Session) => Promise<T>, timeout: number = 0): Promise<T> {
        return this.pool.withSession(callback, timeout);
    }

    public async withSessionRetry<T>(callback: (session: Session) => Promise<T>, timeout: number = 0, maxRetries = 10): Promise<T> {
        return this.pool.withSessionRetry(callback, timeout, maxRetries);
    }

    public async destroy() {
        await this.pool.destroy();
    }
}

export class Column implements Ydb.Table.IColumnMeta {
    constructor(public name: string, public type: IType, public family?: string) {}
}

export class StorageSettings implements Ydb.Table.IStoragePool {
    constructor(public media: string) {}
}

export class ColumnFamilyPolicy implements Ydb.Table.IColumnFamilyPolicy {
    public name?: string;
    public data?: StorageSettings;
    public external?: StorageSettings;
    public keepInMemory?: FeatureFlag;
    public compression?: Compression;

    withName(name: string) {
        this.name = name;
        return this;
    }

    withData(data: StorageSettings) {
        this.data = data;
        return this;
    }

    withExternal(external: StorageSettings) {
        this.external = external;
        return this;
    }

    withKeepInMemory(keepInMemory: FeatureFlag) {
        this.keepInMemory = keepInMemory;
        return this;
    }

    withCompression(compression: Compression) {
        this.compression = compression;
        return this;
    }
}

export class StoragePolicy implements Ydb.Table.IStoragePolicy {
    public presetName?: string;
    public syslog?: StorageSettings;
    public log?: StorageSettings;
    public data?: StorageSettings;
    public external?: StorageSettings;
    public keepInMemory?: FeatureFlag;
    public columnFamilies: ColumnFamilyPolicy[] = [];

    withPresetName(presetName: string) {
        this.presetName = presetName;
        return this;
    }

    withSyslog(syslog: StorageSettings) {
        this.syslog = syslog;
        return this;
    }

    withLog(log: StorageSettings) {
        this.log = log;
        return this;
    }

    withData(data: StorageSettings) {
        this.data = data;
        return this;
    }

    withExternal(external: StorageSettings) {
        this.external = external;
        return this;
    }

    withKeepInMemory(keepInMemory: FeatureFlag) {
        this.keepInMemory = keepInMemory;
        return this;
    }

    withColumnFamilies(...columnFamilies: ColumnFamilyPolicy[]) {
        for (const policy of columnFamilies) {
            this.columnFamilies.push(policy);
        }
        return this;
    }
}

export class ExplicitPartitions implements Ydb.Table.IExplicitPartitions {
    constructor(public splitPoints: ITypedValue[]) {}
}

export class PartitioningPolicy implements Ydb.Table.IPartitioningPolicy {
    public presetName?: string;
    public autoPartitioning?: AutoPartitioningPolicy;
    public uniformPartitions?: number;
    public explicitPartitions?: ExplicitPartitions;

    withPresetName(presetName: string) {
        this.presetName = presetName;
        return this;
    }

    withUniformPartitions(uniformPartitions: number) {
        this.uniformPartitions = uniformPartitions;
        return this;
    }

    withAutoPartitioning(autoPartitioning: AutoPartitioningPolicy) {
        this.autoPartitioning = autoPartitioning;
        return this;
    }

    withExplicitPartitions(explicitPartitions: ExplicitPartitions) {
        this.explicitPartitions = explicitPartitions;
        return this;
    }
}

export class ReplicationPolicy implements Ydb.Table.IReplicationPolicy {
    presetName?: string;
    replicasCount?: number;
    createPerAvailabilityZone?: FeatureFlag;
    allowPromotion?: FeatureFlag;

    withPresetName(presetName: string) {
        this.presetName = presetName;
        return this;
    }

    withReplicasCount(replicasCount: number) {
        this.replicasCount = replicasCount;
        return this;
    }

    withCreatePerAvailabilityZone(createPerAvailabilityZone: FeatureFlag) {
        this.createPerAvailabilityZone = createPerAvailabilityZone;
        return this;
    }

    withAllowPromotion(allowPromotion: FeatureFlag) {
        this.allowPromotion = allowPromotion;
        return this;
    }
}

export class CompactionPolicy implements Ydb.Table.ICompactionPolicy {
    constructor(public presetName: string) {}
}

export class ExecutionPolicy implements Ydb.Table.IExecutionPolicy {
    constructor(public presetName: string) {}
}

export class CachingPolicy implements Ydb.Table.ICachingPolicy {
    constructor(public presetName: string) {}
}

export class TableProfile implements Ydb.Table.ITableProfile {
    public presetName?: string;
    public storagePolicy?: StoragePolicy;
    public compactionPolicy?: CompactionPolicy;
    public partitioningPolicy?: PartitioningPolicy;
    public executionPolicy?: ExecutionPolicy;
    public replicationPolicy?: ReplicationPolicy;
    public cachingPolicy?: CachingPolicy;

    withPresetName(presetName: string) {
        this.presetName = presetName;
        return this;
    }

    withStoragePolicy(storagePolicy: StoragePolicy) {
        this.storagePolicy = storagePolicy;
        return this;
    }

    withCompactionPolicy(compactionPolicy: CompactionPolicy) {
        this.compactionPolicy = compactionPolicy;
        return this;
    }

    withPartitioningPolicy(partitioningPolicy: PartitioningPolicy) {
        this.partitioningPolicy = partitioningPolicy;
        return this;
    }

    withExecutionPolicy(executionPolicy: ExecutionPolicy) {
        this.executionPolicy = executionPolicy;
        return this;
    }

    withReplicationPolicy(replicationPolicy: ReplicationPolicy) {
        this.replicationPolicy = replicationPolicy;
        return this;
    }

    withCachingPolicy(cachingPolicy: CachingPolicy) {
        this.cachingPolicy = cachingPolicy;
        return this;
    }
}

export class TableIndex implements Ydb.Table.ITableIndex {
    public indexColumns: string[] = [];
    public dataColumns: string[] | null = null;
    public globalIndex: Ydb.Table.IGlobalIndex|null = null;
    public globalAsyncIndex: Ydb.Table.IGlobalAsyncIndex|null = null;

    constructor(public name: string) {}

    withIndexColumns(...indexColumns: string[]) {
        this.indexColumns.push(...indexColumns);
        return this;
    }

    /** Adds [covering index](https://ydb.tech/en/docs/concepts/secondary_indexes#covering) over columns */
    withDataColumns(...dataColumns: string[]) {
        if(!this.dataColumns) this.dataColumns = []
        this.dataColumns?.push(...dataColumns)
        return this
    }

    withGlobalAsync(isAsync: boolean) {
        if(isAsync) {
            this.globalAsyncIndex = new Ydb.Table.GlobalAsyncIndex()
            this.globalIndex = null
        }
        else {
            this.globalAsyncIndex = null
            this.globalIndex = new Ydb.Table.GlobalIndex()
        }
        return this
    }
}

export class TtlSettings implements Ydb.Table.ITtlSettings {
    public dateTypeColumn?: Ydb.Table.IDateTypeColumnModeSettings | null;
    constructor(columnName: string, expireAfterSeconds: number = 0) {
        this.dateTypeColumn = { columnName, expireAfterSeconds };
    }
}

export class TableDescription {
    public profile?: TableProfile;
    public indexes: TableIndex[] = [];
    public ttlSettings?: TtlSettings;

    constructor(public columns: Column[] = [], public primaryKey: string[] = []) {}

    withColumn(column: Column) {
        this.columns.push(column);
        return this;
    }

    withColumns(...columns: Column[]) {
        for (const column of columns) {
            this.columns.push(column);
        }
        return this;
    }

    withPrimaryKey(key: string) {
        this.primaryKey.push(key);
        return this;
    }

    withPrimaryKeys(...keys: string[]) {
        for (const key of keys) {
            this.primaryKey.push(key);
        }
        return this;
    }

    withProfile(profile: TableProfile) {
        this.profile = profile;
        return this;
    }

    withIndex(index: TableIndex) {
        this.indexes.push(index);
        return this;
    }

    withIndexes(...indexes: TableIndex[]) {
        for (const index of indexes) {
            this.indexes.push(index);
        }
        return this;
    }

    withTtl(columnName: string, expireAfterSeconds: number = 0) {
        this.ttlSettings = new TtlSettings(columnName, expireAfterSeconds);

        return this;
    }
}

export class AlterTableDescription {
    public addColumns: Column[] = [];
    public dropColumns: string[] = [];
    public alterColumns: Column[] = [];
    public setTtlSettings?: TtlSettings;
    public dropTtlSettings?: {};
    public addIndexes: TableIndex[] = [];
    public dropIndexes: string[] = [];
    public alterStorageSettings?: Ydb.Table.IStorageSettings;
    public addColumnFamilies?: Ydb.Table.IColumnFamily[];
    public alterColumnFamilies?: Ydb.Table.IColumnFamily[];
    public alterAttributes?: { [k: string]: string };
    public setCompactionPolicy?: string;
    public alterPartitioningSettings?: Ydb.Table.IPartitioningSettings;
    public setKeyBloomFilter?: Ydb.FeatureFlag.Status;
    public setReadReplicasSettings?: Ydb.Table.IReadReplicasSettings;
    public addChangefeeds?: Ydb.Table.IChangefeed[];
    public dropChangefeeds?: string[];
    public renameIndexes?: Ydb.Table.IRenameIndexItem[];

    constructor() {}

    withAddColumn(column: Column) {
        this.addColumns.push(column);
        return this;
    }

    withDropColumn(columnName: string) {
        this.dropColumns.push(columnName);
        return this;
    }

    withAlterColumn(column: Column) {
        this.alterColumns.push(column);
        return this;
    }

    withSetTtl(columnName: string, expireAfterSeconds: number = 0) {
        this.setTtlSettings = new TtlSettings(columnName, expireAfterSeconds);
        return this;
    }

    withDropTtl() {
        this.dropTtlSettings = {};
        return this;
    }
}
