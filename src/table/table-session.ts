import {google, Ydb} from "ydb-sdk-proto";
import IQuery = Ydb.Table.IQuery;
import IType = Ydb.IType;
import DescribeTableResult = Ydb.Table.DescribeTableResult;
import PrepareQueryResult = Ydb.Table.PrepareQueryResult;
import ExecuteQueryResult = Ydb.Table.ExecuteQueryResult;
import ExplainQueryResult = Ydb.Table.ExplainQueryResult;
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
import * as grpc from "@grpc/grpc-js";
import EventEmitter from "events";
import {ICreateSessionResult, SessionEvent, TableService} from "./table-session-pool";
import {Endpoint} from "../discovery";
import {Logger} from "../logger/simple-logger";
import {retryable} from "../retries";
import {MissingStatus, MissingValue, SchemeError, YdbError} from "../errors";
import {ResponseMetadataKeys} from "../constants";
import {pessimizable} from "../utils";
import {YdbOperationAsyncResponse, ensureOperationSucceeded, getOperationPayload} from "../utils/process-ydb-operation-result";
import {StreamEnd} from "../utils";
import {HasLogger} from "../logger/HasLogger";

interface PartialResponse<T> {
    status?: (Ydb.StatusIds.StatusCode | null);
    issues?: (Ydb.Issue.IIssueMessage[] | null);
    result?: (T | null);
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

export class TableSession extends EventEmitter implements ICreateSessionResult, HasLogger {
    private beingDeleted = false;
    private free = true;
    private closing = false;

    constructor(
        private api: TableService,
        public endpoint: Endpoint,
        public sessionId: string,
        public readonly logger: Logger,
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
    public async createTable(
        tablePath: string,
        description: TableDescription,
        settings?: CreateTableSettings,
    ): Promise<void> {
        const request: Ydb.Table.ICreateTableRequest = {
            ...description,
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
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
        response: YdbOperationAsyncResponse,
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
        apiStreamMethod: (request: Req, callback: (error: (Error | null), response?: Resp) => void) => void,
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

    public async explainQuery(query: string, operationParams?: Ydb.Operations.IOperationParams): Promise<ExplainQueryResult> {
        const request: Ydb.Table.IExplainDataQueryRequest = {
            sessionId: this.sessionId,
            yqlText: query,
            operationParams
        };
        const response = await this.api.explainDataQuery(request);
        const payload = getOperationPayload(this.processResponseMetadata(request, response));
        return ExplainQueryResult.decode(payload);
    }
}

export class Column implements Ydb.Table.IColumnMeta {
    constructor(public name: string, public type: IType, public family?: string) {
    }
}

export class StorageSettings implements Ydb.Table.IStoragePool {
    constructor(public media: string) {
    }
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
    constructor(public splitPoints: ITypedValue[]) {
    }
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
    constructor(public presetName: string) {
    }
}

export class ExecutionPolicy implements Ydb.Table.IExecutionPolicy {
    constructor(public presetName: string) {
    }
}

export class CachingPolicy implements Ydb.Table.ICachingPolicy {
    constructor(public presetName: string) {
    }
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
    public globalIndex: Ydb.Table.IGlobalIndex | null = null;
    public globalAsyncIndex: Ydb.Table.IGlobalAsyncIndex | null = null;

    constructor(public name: string) {
    }

    withIndexColumns(...indexColumns: string[]) {
        this.indexColumns.push(...indexColumns);
        return this;
    }

    /** Adds [covering index](https://ydb.tech/en/docs/concepts/secondary_indexes#covering) over columns */
    withDataColumns(...dataColumns: string[]) {
        if (!this.dataColumns) this.dataColumns = []
        this.dataColumns?.push(...dataColumns)
        return this
    }

    withGlobalAsync(isAsync: boolean) {
        if (isAsync) {
            this.globalAsyncIndex = new Ydb.Table.GlobalAsyncIndex()
            this.globalIndex = null
        } else {
            this.globalAsyncIndex = null
            this.globalIndex = new Ydb.Table.GlobalIndex()
        }
        return this
    }
}

export class TtlSettings implements Ydb.Table.ITtlSettings {
    public dateTypeColumn?: Ydb.Table.IDateTypeColumnModeSettings | null;

    constructor(columnName: string, expireAfterSeconds: number = 0) {
        this.dateTypeColumn = {columnName, expireAfterSeconds};
    }
}

export class TableDescription implements Ydb.Table.ICreateTableRequest {
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

    constructor(public columns: Column[] = [], public primaryKey: string[] = []) {
    }

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

    withTtl(columnName: string, expireAfterSeconds: number = 0) {
        this.ttlSettings = new TtlSettings(columnName, expireAfterSeconds);
        return this;
    }

    withPartitioningSettings(partitioningSettings: Ydb.Table.IPartitioningSettings) {
        this.partitioningSettings = partitioningSettings;
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

    constructor() {
    }

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
