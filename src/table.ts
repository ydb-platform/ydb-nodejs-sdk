// /* eslint local-rules/context: "error" */

// eslint-disable-next-line max-classes-per-file
import _ from 'lodash';
import EventEmitter from 'events';
import * as grpc from '@grpc/grpc-js';
import { google, Ydb } from 'ydb-sdk-proto';
import {
    AuthenticatedService,
    ClientOptions,
    StreamEnd,
    ensureOperationSucceeded,
    getOperationPayload,
    pessimizable,
    AsyncResponse,
} from './utils';
import DiscoveryService, { Endpoint } from './discovery';
import { IPoolSettings } from './driver';
import { ISslCredentials } from './ssl-credentials';
import { Events, ResponseMetadataKeys, SESSION_KEEPALIVE_PERIOD } from './constants';
import { IAuthService } from './credentials';
// noinspection ES6PreferShortImport
import { Logger } from './logging';
import { retryable } from './retries';
import {
    SchemeError,
    SessionPoolEmpty,
    BadSession,
    SessionBusy,
    MissingValue,
    YdbError,
    MissingStatus,
} from './errors';
import { ContextWithLogger } from './context-with-logger';

import TableService = Ydb.Table.V1.TableService;
import CreateSessionRequest = Ydb.Table.CreateSessionRequest;
import ICreateSessionResult = Ydb.Table.ICreateSessionResult;
import CreateSessionResult = Ydb.Table.CreateSessionResult;
import IQuery = Ydb.Table.IQuery;
import IType = Ydb.IType;
import DescribeTableResult = Ydb.Table.DescribeTableResult;
import PrepareQueryResult = Ydb.Table.PrepareQueryResult;
import ExecuteQueryResult = Ydb.Table.ExecuteQueryResult;
import ExplainQueryResult = Ydb.Table.ExplainQueryResult;
import ITransactionSettings = Ydb.Table.ITransactionSettings;
import BeginTransactionResult = Ydb.Table.BeginTransactionResult;
import ITransactionMeta = Ydb.Table.ITransactionMeta;
// eslint-disable-next-line @typescript-eslint/no-use-before-define
import AutoPartitioningPolicy = Ydb.Table.PartitioningPolicy.AutoPartitioningPolicy;
import ITypedValue = Ydb.ITypedValue;
import FeatureFlag = Ydb.FeatureFlag.Status;
// eslint-disable-next-line @typescript-eslint/no-use-before-define
import Compression = Ydb.Table.ColumnFamilyPolicy.Compression;
import ExecuteScanQueryPartialResult = Ydb.Table.ExecuteScanQueryPartialResult;
import IKeyRange = Ydb.Table.IKeyRange;
import TypedValue = Ydb.TypedValue;
import BulkUpsertResult = Ydb.Table.BulkUpsertResult;
// eslint-disable-next-line @typescript-eslint/no-use-before-define
import OperationMode = Ydb.Operations.OperationParams.OperationMode;

interface PartialResponse<T> {
    status?: (Ydb.StatusIds.StatusCode | null);
    issues?: (Ydb.Issue.IIssueMessage[] | null);
    result?: (T | null);
}

export class SessionService extends AuthenticatedService<TableService> {
    public endpoint: Endpoint;
    // @ts-ignore
    private readonly logger: Logger;

    // eslint-disable-next-line max-len
    constructor(endpoint: Endpoint, database: string, authService: IAuthService, logger: Logger, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions) {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:SessionService.constructor', logger);
        const host = ctx.doSync(() => endpoint.toString());

        super(host, database, 'Ydb.Table.V1.TableService', TableService, authService, sslCredentials, clientOptions);
        this.endpoint = endpoint;
        this.logger = logger;
    }

    @retryable()
    @pessimizable
    async create(): Promise<Session> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:SessionService.create', this);
        const response = await ctx.do(() => this.api.createSession(ctx.doSync(() => CreateSessionRequest.create())));
        const payload = ctx.doSync(() => getOperationPayload(response));
        const { sessionId } = ctx.doSync(() => CreateSessionResult.decode(payload));

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return new Session(this.api, this.endpoint, sessionId, ctx.logger, ctx.doSync(() => this.getResponseMetadata.bind(this)));
    }
}

enum SessionEvent {
    SESSION_RELEASE = 'SESSION_RELEASE',
    SESSION_BROKEN = 'SESSION_BROKEN',
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
        serializableReadWrite: {},
    },
    commitTx: true,
};

interface IQueryParams {
    [k: string]: Ydb.ITypedValue
}

export class OperationParams implements Ydb.Operations.IOperationParams {
    // local-rules/context: no-trace

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
        this.operationTimeout = { seconds };

        return this;
    }

    withCancelAfter(duration: google.protobuf.IDuration) {
        this.cancelAfter = duration;

        return this;
    }

    withCancelAfterSeconds(seconds: number) {
        this.cancelAfter = { seconds };

        return this;
    }

    withLabels(labels: { [k: string]: string }) {
        this.labels = labels;

        return this;
    }

    withReportCostInfo() {
        this.reportCostInfo = Ydb.FeatureFlag.Status.ENABLED;

        return this;
    }
}

export class OperationParamsSettings {
    // local-rules/context: no-trace

    operationParams?: OperationParams;

    withOperationParams(operationParams: OperationParams) {
        this.operationParams = operationParams;

        return this;
    }
}

export class CreateTableSettings extends OperationParamsSettings {}

export class AlterTableSettings extends OperationParamsSettings {}

interface IDropTableSettings {
    muteNonExistingTableErrors: boolean;
}
export class DropTableSettings extends OperationParamsSettings {
    // local-rules/context: no-trace

    muteNonExistingTableErrors: boolean;

    constructor({ muteNonExistingTableErrors = true } = {} as IDropTableSettings) {
        super();
        this.muteNonExistingTableErrors = muteNonExistingTableErrors;
    }
}

export class DescribeTableSettings extends OperationParamsSettings {
    // local-rules/context: no-trace

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

export class BeginTransactionSettings extends OperationParamsSettings {}

export class CommitTransactionSettings extends OperationParamsSettings {
    // local-rules/context: no-trace

    collectStats?: Ydb.Table.QueryStatsCollection.Mode;

    withCollectStats(collectStats: Ydb.Table.QueryStatsCollection.Mode) {
        this.collectStats = collectStats;

        return this;
    }
}

export class RollbackTransactionSettings extends OperationParamsSettings {}

export class PrepareQuerySettings extends OperationParamsSettings {}

export class ExecuteQuerySettings extends OperationParamsSettings {
    // local-rules/context: no-trace

    keepInCache = false;
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

export class BulkUpsertSettings extends OperationParamsSettings {}

export class ReadTableSettings {
    // local-rules/context: no-trace

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
    // local-rules/context: no-trace

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

// eslint-disable-next-line unicorn/prefer-event-target
export class Session extends EventEmitter implements ICreateSessionResult {
    private beingDeleted = false;
    private free = true;
    private closing = false;

    constructor(
        private api: TableService,
        public endpoint: Endpoint,
        public sessionId: string,
        // @ts-ignore
        private logger: Logger,
        private getResponseMetadata: (request: object) => grpc.Metadata | undefined,
    ) {
        super();
        ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.constructor', this);
    }

    acquire() {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.acquire', this);

        this.free = false;
        ctx.logger.debug(`Acquired session ${this.sessionId} on endpoint ${ctx.doSync(() => this.endpoint.toString())}.`);

        return this;
    }
    release() {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.release', this);

        this.free = true;
        ctx.logger.debug(`Released session ${this.sessionId} on endpoint ${ctx.doSync(() => this.endpoint.toString())}.`);
        ctx.doSync(() => this.emit(SessionEvent.SESSION_RELEASE, this));
    }

    public isFree() {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.isFree', this);

        return this.free && !ctx.doSync(() => this.isDeleted());
    }
    public isClosing() {
        ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.isClosing', this);

        return this.closing;
    }
    public isDeleted() {
        ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.isDeleted', this);

        return this.beingDeleted;
    }

    @retryable()
    @pessimizable
    public async delete(): Promise<void> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.delete', this);

        if (ctx.doSync(() => this.isDeleted())) {
            return;
        }
        this.beingDeleted = true;
        await ctx.do(async () => ensureOperationSucceeded(await ctx.do(() => this.api.deleteSession({ sessionId: this.sessionId }))));
    }

    @retryable()
    @pessimizable
    public async keepAlive(): Promise<void> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.keepAlive', this);
        const request = { sessionId: this.sessionId };
        const response = await ctx.do(() => this.api.keepAlive(request));

        ctx.doSync(() => ensureOperationSucceeded(ctx.doSync(() => this.processResponseMetadata(request, response))));
    }

    @retryable()
    @pessimizable
    public async createTable(
        tablePath: string,
        description: TableDescription,
        settings?: CreateTableSettings,
    ): Promise<void> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.createTable', this);
        const request: Ydb.Table.ICreateTableRequest = {
            ...description,
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
        };

        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await ctx.do(() => this.api.createTable(request));

        ctx.doSync(() => ensureOperationSucceeded(ctx.doSync(() => this.processResponseMetadata(request, response))));
    }

    @retryable()
    @pessimizable
    public async alterTable(
        tablePath: string,
        description: AlterTableDescription,
        settings?: AlterTableSettings,
    ): Promise<void> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.alterTable', this);
        const request: Ydb.Table.IAlterTableRequest = {
            ...description,
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
        };

        if (settings) {
            request.operationParams = settings.operationParams;
        }

        const response = await ctx.do(() => this.api.alterTable(request));

        try {
            ctx.doSync(() => ensureOperationSucceeded(ctx.doSync(() => this.processResponseMetadata(request, response))));
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
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.dropTable', this);
        const request: Ydb.Table.IDropTableRequest = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
        };

        if (settings) {
            request.operationParams = settings.operationParams;
        }
        // eslint-disable-next-line no-param-reassign
        settings = settings || new DropTableSettings();
        const suppressedErrors = settings?.muteNonExistingTableErrors ? [SchemeError.status] : [];
        const response = await ctx.do(() => this.api.dropTable(request));

        ctx.doSync(() => ensureOperationSucceeded(ctx.doSync(() => this.processResponseMetadata(request, response)), suppressedErrors));
    }

    @retryable()
    @pessimizable
    public async describeTable(tablePath: string, settings?: DescribeTableSettings): Promise<DescribeTableResult> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.describeTable', this);
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

        const response = await ctx.do(() => this.api.describeTable(request));
        const payload = ctx.doSync(() => getOperationPayload(ctx.doSync(() => this.processResponseMetadata(request, response))));

        return ctx.doSync(() => DescribeTableResult.decode(payload));
    }

    @retryable()
    @pessimizable
    public async describeTableOptions(
        settings?: DescribeTableSettings,
    ): Promise<Ydb.Table.DescribeTableOptionsResult> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.describeTableOptions', this);
        const request: Ydb.Table.IDescribeTableOptionsRequest = {
            operationParams: settings?.operationParams,
        };

        const response = await ctx.do(() => this.api.describeTableOptions(request));
        const payload = ctx.doSync(() => getOperationPayload(ctx.doSync(() => this.processResponseMetadata(request, response))));

        return ctx.doSync(() => Ydb.Table.DescribeTableOptionsResult.decode(payload));
    }

    @retryable()
    @pessimizable
    public async beginTransaction(
        txSettings: ITransactionSettings,
        settings?: BeginTransactionSettings,
    ): Promise<ITransactionMeta> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.beginTransaction', this);
        const request: Ydb.Table.IBeginTransactionRequest = {
            sessionId: this.sessionId,
            txSettings,
        };

        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await ctx.do(() => this.api.beginTransaction(request));
        const payload = ctx.doSync(() => getOperationPayload(ctx.doSync(() => this.processResponseMetadata(request, response))));
        const { txMeta } = ctx.doSync(() => BeginTransactionResult.decode(payload));

        if (txMeta) {
            return txMeta;
        }
        throw new Error('Could not begin new transaction, txMeta is empty!');
    }

    @retryable()
    @pessimizable
    public async commitTransaction(txControl: IExistingTransaction, settings?: CommitTransactionSettings): Promise<void> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.commitTransaction', this);
        const request: Ydb.Table.ICommitTransactionRequest = {
            sessionId: this.sessionId,
            txId: txControl.txId,
        };

        if (settings) {
            request.operationParams = settings.operationParams;
            request.collectStats = settings.collectStats;
        }
        const response = await ctx.do(() => this.api.commitTransaction(request));

        ctx.doSync(() => ensureOperationSucceeded(ctx.doSync(() => this.processResponseMetadata(request, response))));
    }

    @retryable()
    @pessimizable
    public async rollbackTransaction(txControl: IExistingTransaction, settings?: RollbackTransactionSettings): Promise<void> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.rollbackTransaction', this);
        const request: Ydb.Table.IRollbackTransactionRequest = {
            sessionId: this.sessionId,
            txId: txControl.txId,
        };

        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await ctx.do(() => this.api.rollbackTransaction(request));

        ctx.doSync(() => ensureOperationSucceeded(ctx.doSync(() => this.processResponseMetadata(request, response))));
    }

    @retryable()
    @pessimizable
    public async prepareQuery(queryText: string, settings?: PrepareQuerySettings): Promise<PrepareQueryResult> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.prepareQuery', this);
        const request: Ydb.Table.IPrepareDataQueryRequest = {
            sessionId: this.sessionId,
            yqlText: queryText,
        };

        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await ctx.do(() => this.api.prepareDataQuery(request));
        const payload = ctx.doSync(() => getOperationPayload(ctx.doSync(() => this.processResponseMetadata(request, response))));

        return ctx.doSync(() => PrepareQueryResult.decode(payload));
    }

    @pessimizable
    public async executeQuery(
        query: PrepareQueryResult | string,
        params: IQueryParams = {},
        txControl: IExistingTransaction | INewTransaction = AUTO_TX,
        settings?: ExecuteQuerySettings,
    ): Promise<ExecuteQueryResult> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.executeQuery', this);

        ctx.logger.trace('preparedQuery %o', query);
        ctx.logger.trace('parameters %o', params);
        let queryToExecute: IQuery;
        let keepInCache = false;

        if (typeof query === 'string') {
            queryToExecute = {
                yqlText: query,
            };
            if (settings?.keepInCache !== undefined) {
                keepInCache = settings.keepInCache;
            }
        } else {
            queryToExecute = {
                id: query.queryId,
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
            request.queryCachePolicy = { keepInCache };
        }
        const response = await ctx.do(() => this.api.executeDataQuery(request));
        const payload = ctx.doSync(() => getOperationPayload(ctx.doSync(() => this.processResponseMetadata(request, response, settings?.onResponseMetadata))));

        return ctx.doSync(() => ExecuteQueryResult.decode(payload));
    }

    private processResponseMetadata(
        request: object,
        response: AsyncResponse,
        onResponseMetadata?: (metadata: grpc.Metadata) => void,
    ) {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.processResponseMetadata', this);
        const metadata = ctx.doSync(() => this.getResponseMetadata(request));

        if (metadata) {
            const serverHints = ctx.doSync(() => metadata.get(ResponseMetadataKeys.ServerHints)) || [];

            if (ctx.doSync(() => serverHints.includes('session-close'))) {
                this.closing = true;
            }
            ctx.doSync(() => ctx.doSync(() => onResponseMetadata?.(metadata)));
        }

        return response;
    }

    @pessimizable
    public async bulkUpsert(tablePath: string, rows: TypedValue, settings?: BulkUpsertSettings) {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.bulkUpsert', this);
        const request: Ydb.Table.IBulkUpsertRequest = {
            table: `${this.endpoint.database}/${tablePath}`,
            rows,
        };

        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await ctx.do(() => this.api.bulkUpsert(request));
        const payload = ctx.doSync(() => getOperationPayload(ctx.doSync(() => this.processResponseMetadata(request, response))));

        return ctx.doSync(() => BulkUpsertResult.decode(payload));
    }

    @pessimizable
    public async streamReadTable(
        tablePath: string,
        consumer: (result: Ydb.Table.ReadTableResult) => void,
        settings?: ReadTableSettings,
    ): Promise<void> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.streamReadTable', this);
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

        return ctx.doSync(() => this.executeStreamRequest(
            request,
            ctx.doSync(() => this.api.streamReadTable.bind(this.api)),
            Ydb.Table.ReadTableResult.create,
            consumer,
        ));
    }

    @pessimizable
    public async streamExecuteScanQuery(
        query: PrepareQueryResult | string,
        consumer: (result: ExecuteScanQueryPartialResult) => void,
        params: IQueryParams = {},
        settings?: ExecuteScanQuerySettings,
    ): Promise<void> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.streamExecuteScanQuery', this);
        let queryToExecute: IQuery;

        // eslint-disable-next-line prefer-const
        queryToExecute = typeof query === 'string' ? {
            yqlText: query,
        } : {
            id: query.queryId,
        };

        const request: Ydb.Table.IExecuteScanQueryRequest = {
            query: queryToExecute,
            parameters: params,
            mode: settings?.mode || Ydb.Table.ExecuteScanQueryRequest.Mode.MODE_EXEC,
        };

        if (settings) {
            request.collectStats = settings.collectStats;
        }

        return ctx.doSync(() => this.executeStreamRequest(
            request,
            ctx.doSync(() => this.api.streamExecuteScanQuery.bind(this.api)),
            ExecuteScanQueryPartialResult.create,
            consumer,
        ));
    }

    private executeStreamRequest<Req, Resp extends PartialResponse<IRes>, IRes, Res>(
        request: Req,
        apiStreamMethod: (request: Req, callback: (error: (Error | null), response?: Resp) => void) => void,
        transformer: (result: IRes) => Res,
        consumer: (result: Res) => void,
    )
        : Promise<void> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.executeStreamRequest', this);

        return new Promise((resolve, reject) => {
            ctx.doSync(() => apiStreamMethod(request, (error, response) => {
                try {
                    if (error) {
                        if (error instanceof StreamEnd) {
                            ctx.doSync(() => resolve());
                        } else {
                            ctx.doSync(() => reject(error));
                        }
                    } else if (response) {
                        const operation = {
                            status: response.status,
                            issues: response.issues,
                        } as Ydb.Operations.IOperation;

                        ctx.doSync(() => YdbError.checkStatus(operation));

                        if (!response.result) {
                            ctx.doSync(() => reject(new MissingValue('Missing result value!')));

                            return;
                        }

                        const result = ctx.doSync(() => transformer(response.result!));

                        ctx.doSync(() => consumer(result));
                    }
                } catch (error_) {
                    ctx.doSync(() => reject(error_)); // TODO: doSync in doSync
                }
            }));
        });
    }

    public async explainQuery(query: string, operationParams?: Ydb.Operations.IOperationParams): Promise<ExplainQueryResult> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:Session.explainQuery', this);
        const request: Ydb.Table.IExplainDataQueryRequest = {
            sessionId: this.sessionId,
            yqlText: query,
            operationParams,
        };
        const response = await ctx.do(() => this.api.explainDataQuery(request));
        const payload = ctx.doSync(() => getOperationPayload(ctx.doSync(() => this.processResponseMetadata(request, response))));

        return ctx.doSync(() => ExplainQueryResult.decode(payload));
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

// eslint-disable-next-line unicorn/prefer-event-target
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
    // @ts-ignore
    private readonly logger: Logger;
    private readonly waiters: ((session: Session) => void)[] = [];

    private static SESSION_MIN_LIMIT = 5;
    private static SESSION_MAX_LIMIT = 20;

    constructor(settings: ITableClientSettings) {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:SessionPool.constructor', settings.logger);

        super();
        this.database = settings.database;
        this.authService = settings.authService;
        this.sslCredentials = settings.sslCredentials;
        this.clientOptions = settings.clientOptions;
        this.logger = settings.logger;
        const { poolSettings, discoveryService } = settings;

        this.minLimit = poolSettings?.minLimit || SessionPool.SESSION_MIN_LIMIT;
        this.maxLimit = poolSettings?.maxLimit || SessionPool.SESSION_MAX_LIMIT;
        this.sessions = new Set();
        this.newSessionsRequested = 0;
        this.sessionsBeingDeleted = 0;
        this.sessionKeepAliveId = ctx.doSync(() => this.initListeners(poolSettings?.keepAlivePeriod || SESSION_KEEPALIVE_PERIOD));
        this.sessionCreators = new Map();
        this.discoveryService = discoveryService;
        ctx.doSync(() => this.discoveryService.on(Events.ENDPOINT_REMOVED, (endpoint: Endpoint) => {
            ctx.doSync(() => this.sessionCreators.delete(endpoint));
        }));
        ctx.doSync(() => this.prepopulateSessions());
    }

    public async destroy(): Promise<void> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:SessionPool.destroy', this);

        ctx.logger.debug('Destroying pool...');
        ctx.doSync(() => clearInterval(this.sessionKeepAliveId));
        await Promise.all(ctx.doSync(() => _.map([...this.sessions], (session: Session) => ctx.doSync(() => this.deleteSession(session)))));
        ctx.logger.debug('Pool has been destroyed.');
    }

    private initListeners(keepAlivePeriod: number) {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:SessionPool.initListeners', this);

        return setInterval(async () => Promise.all(
            ctx.doSync(() => _.map([...this.sessions], (session: Session) => ctx.doSync(() => ctx.doSync(() => ctx.doSync(() => session.keepAlive())
                // delete session if error
                .catch(() => ctx.doSync(() => this.deleteSession(session))))
                // ignore errors to avoid UnhandledPromiseRejectionWarning
                .catch(() => {})))),
        ), keepAlivePeriod);
    }

    private prepopulateSessions() {
        // eslint-disable-next-line unicorn/no-array-for-each
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:SessionPool.prepopulateSessions', this);

        ctx.doSync(() => _.forEach(ctx.doSync(() => _.range(this.minLimit)), () => ctx.doSync(() => this.createSession())));
    }

    private async getSessionCreator(): Promise<SessionService> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:SessionPool.getSessionCreator', this);
        const endpoint = await ctx.do(() => this.discoveryService.getEndpoint());

        if (!ctx.doSync(() => this.sessionCreators.has(endpoint))) {
            // eslint-disable-next-line max-len
            const sessionService = new SessionService(endpoint, this.database, this.authService, ctx.logger, this.sslCredentials, this.clientOptions);

            ctx.doSync(() => this.sessionCreators.set(endpoint, sessionService));
        }

        return ctx.doSync(() => this.sessionCreators.get(endpoint)) as SessionService;
    }

    private maybeUseSession(session: Session) {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:SessionPool.maybeUseSession', this);

        if (this.waiters.length > 0) {
            const waiter = ctx.doSync(() => this.waiters.shift());

            if (typeof waiter === 'function') {
                ctx.doSync(() => waiter(session));

                return true;
            }
        }

        return false;
    }

    private async createSession(): Promise<Session> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:SessionPool.createSession', this);
        const sessionCreator = await ctx.do(() => this.getSessionCreator());
        const session = await ctx.do(() => sessionCreator.create());

        ctx.doSync(() => session.on(SessionEvent.SESSION_RELEASE, async () => {
            if (ctx.doSync(() => session.isClosing())) {
                await ctx.do(() => this.deleteSession(session));
            } else {
                ctx.doSync(() => this.maybeUseSession(session));
            }
        }));
        ctx.doSync(() => session.on(SessionEvent.SESSION_BROKEN, async () => {
            await ctx.do(() => this.deleteSession(session));
        }));
        ctx.doSync(() => this.sessions.add(session));

        return session;
    }

    private deleteSession(session: Session): Promise<void> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:SessionPool.deleteSession', this);

        if (ctx.doSync(() => session.isDeleted())) {
            return Promise.resolve();
        }

        this.sessionsBeingDeleted++;
        // acquire new session as soon one of existing ones is deleted
        if (this.waiters.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-shadow
            ctx.doSync(() => ctx.doSync(() => this.acquire()).then((session) => {
                if (!ctx.doSync(() => this.maybeUseSession(session))) {
                    ctx.doSync(() => session.release());
                }
            }));
        }

        return ctx.doSync(() => ctx.doSync(() => session.delete())
        // delete session in any case
            .finally(() => {
                ctx.doSync(() => this.sessions.delete(session));
                this.sessionsBeingDeleted--;
            }));
    }

    private acquire(timeout = 0): Promise<Session> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:SessionPool.acquire', this);

        for (const session of this.sessions) {
            if (ctx.doSync(() => session.isFree())) {
                return Promise.resolve(ctx.doSync(() => session.acquire()));
            }
        }

        if (this.sessions.size + this.newSessionsRequested - this.sessionsBeingDeleted <= this.maxLimit) {
            this.newSessionsRequested++;

            return ctx.doSync(() => ctx.doSync(() => ctx.doSync(() => this.createSession())
                .then((session) => ctx.doSync(() => session.acquire())))
                .finally(() => {
                    this.newSessionsRequested--;
                }));
        }

        return new Promise((resolve, reject) => {
            let timeoutId: NodeJS.Timeout;

            const waiter = (session: Session) => {
                ctx.doSync(() => clearTimeout(timeoutId));
                ctx.doSync(() => resolve(ctx.doSync(() => session.acquire())));
            };

            if (timeout) {
                timeoutId = setTimeout(() => {
                    ctx.doSync(() => this.waiters.splice(ctx.doSync(() => this.waiters.indexOf(waiter)), 1));
                    ctx.doSync(() => reject(
                        new SessionPoolEmpty(`No session became available within timeout of ${timeout} ms`),
                    ));
                }, timeout);
            }
            ctx.doSync(() => this.waiters.push(waiter));
        });
    }

    private async _withSession<T>(session: Session, callback: SessionCallback<T>, maxRetries = 0): Promise<T> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:SessionPool._withSession', this);

        try {
            const result = await ctx.do(() => callback(session));

            ctx.doSync(() => session.release());

            return result;
        } catch (error) {
            if (error instanceof BadSession || error instanceof SessionBusy) {
                ctx.logger.debug('Encountered bad or busy session, re-creating the session');
                ctx.doSync(() => session.emit(SessionEvent.SESSION_BROKEN));
                // eslint-disable-next-line no-param-reassign
                session = await ctx.do(() => this.createSession());
                if (maxRetries > 0) {
                    ctx.logger.debug(`Re-running operation in new session, ${maxRetries} left.`);
                    ctx.doSync(() => session.acquire());

                    return ctx.doSync(() => this._withSession(session, callback, maxRetries - 1));
                }
            } else {
                ctx.doSync(() => session.release());
            }
            throw error;
        }
    }

    public async withSession<T>(callback: SessionCallback<T>, timeout = 0): Promise<T> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:SessionPool.withSession', this);
        const session = await ctx.do(() => this.acquire(timeout));

        return ctx.doSync(() => this._withSession(session, callback));
    }

    public async withSessionRetry<T>(callback: SessionCallback<T>, timeout = 0, maxRetries = 10): Promise<T> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:SessionPool.withSessionRetry', this);
        const session = await ctx.do(() => this.acquire(timeout));

        return ctx.doSync(() => this._withSession(session, callback, maxRetries));
    }
}

// eslint-disable-next-line unicorn/prefer-event-target
export class TableClient extends EventEmitter {
    private pool: SessionPool;

    constructor(settings: ITableClientSettings) {
        ContextWithLogger.getSafe('ydb-nodejs-sdk:TableClient.constructor', settings.logger);
        super();
        this.pool = new SessionPool(settings);
    }

    public async withSession<T>(callback: (session: Session) => Promise<T>, timeout = 0): Promise<T> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:TableClient.withSession', this);

        return ctx.doSync(() => this.pool.withSession(callback, timeout));
    }

    public async withSessionRetry<T>(callback: (session: Session) => Promise<T>, timeout = 0, maxRetries = 10): Promise<T> {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:TableClient.withSessionRetry', this);

        return ctx.doSync(() => this.pool.withSessionRetry(callback, timeout, maxRetries));
    }

    public async destroy() {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:TableClient.destroy', this);

        await ctx.do(() => this.pool.destroy());
    }
}

export class Column implements Ydb.Table.IColumnMeta {
    // local-rules/context: no-trace

    constructor(public name: string, public type: IType, public family?: string) {}
}

export class StorageSettings implements Ydb.Table.IStoragePool {
    // local-rules/context: no-trace
    constructor(public media: string) {}
}

export class ColumnFamilyPolicy implements Ydb.Table.IColumnFamilyPolicy {
    // local-rules/context: no-trace

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
    // local-rules/context: no-trace

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
    // local-rules/context: no-trace
    constructor(public splitPoints: ITypedValue[]) {}
}

export class PartitioningPolicy implements Ydb.Table.IPartitioningPolicy {
    // local-rules/context: no-trace

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
    // local-rules/context: no-trace

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
    // local-rules/context: no-trace
    constructor(public presetName: string) {}
}

export class ExecutionPolicy implements Ydb.Table.IExecutionPolicy {
    // local-rules/context: no-trace
    constructor(public presetName: string) {}
}

export class CachingPolicy implements Ydb.Table.ICachingPolicy {
    // local-rules/context: no-trace
    constructor(public presetName: string) {}
}

export class TableProfile implements Ydb.Table.ITableProfile {
    // local-rules/context: no-trace

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
    // local-rules/context: no-trace

    public indexColumns: string[] = [];
    public dataColumns: string[] | null = null;
    public globalIndex: Ydb.Table.IGlobalIndex | null = null;
    public globalAsyncIndex: Ydb.Table.IGlobalAsyncIndex | null = null;

    constructor(public name: string) {}

    withIndexColumns(...indexColumns: string[]) {
        this.indexColumns.push(...indexColumns);

        return this;
    }

    /** Adds [covering index](https://ydb.tech/en/docs/concepts/secondary_indexes#covering) over columns */
    withDataColumns(...dataColumns: string[]) {
        if (!this.dataColumns) this.dataColumns = [];
        this.dataColumns?.push(...dataColumns);

        return this;
    }

    withGlobalAsync(isAsync: boolean) {
        if (isAsync) {
            this.globalAsyncIndex = new Ydb.Table.GlobalAsyncIndex();
            this.globalIndex = null;
        } else {
            this.globalAsyncIndex = null;
            this.globalIndex = new Ydb.Table.GlobalIndex();
        }

        return this;
    }
}

export class TtlSettings implements Ydb.Table.ITtlSettings {
    // local-rules/context: no-trace

    public dateTypeColumn?: Ydb.Table.IDateTypeColumnModeSettings | null;
    constructor(columnName: string, expireAfterSeconds = 0) {
        this.dateTypeColumn = { columnName, expireAfterSeconds };
    }
}

export class TableDescription implements Ydb.Table.ICreateTableRequest {
    // local-rules/context: no-trace

    /** @deprecated use TableDescription options instead */
    public profile?: TableProfile;
    public indexes: TableIndex[] = [];
    public ttlSettings?: TtlSettings;
    public partitioningSettings?: Ydb.Table.IPartitioningSettings;
    public uniformPartitions?: number;
    public columnFamilies?: Ydb.Table.IColumnFamily[];
    public attributes?: { [k: string]: string };
    public compactionPolicy?: 'default' | 'small_table' | 'log_table';
    public keyBloomFilter?: FeatureFlag;
    public partitionAtKeys?: Ydb.Table.IExplicitPartitions;
    public readReplicasSettings?: Ydb.Table.IReadReplicasSettings;
    public storageSettings?: Ydb.Table.IStorageSettings;
    // path and operationPrams defined in createTable,
    // columns and primaryKey are in constructor

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

    /** @deprecated use TableDescription options instead */
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

    withTtl(columnName: string, expireAfterSeconds = 0) {
        this.ttlSettings = new TtlSettings(columnName, expireAfterSeconds);

        return this;
    }

    withPartitioningSettings(partitioningSettings: Ydb.Table.IPartitioningSettings) {
        this.partitioningSettings = partitioningSettings;
    }
}

export class AlterTableDescription {
    // local-rules/context: no-trace

    public addColumns: Column[] = [];
    public dropColumns: string[] = [];
    public alterColumns: Column[] = [];
    public setTtlSettings?: TtlSettings;
    public dropTtlSettings?: object;
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

    // eslint-disable-next-line @typescript-eslint/no-useless-constructor,@typescript-eslint/no-empty-function
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

    withSetTtl(columnName: string, expireAfterSeconds = 0) {
        this.setTtlSettings = new TtlSettings(columnName, expireAfterSeconds);

        return this;
    }

    withDropTtl() {
        this.dropTtlSettings = {};

        return this;
    }
}
