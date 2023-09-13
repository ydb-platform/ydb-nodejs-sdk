/// <reference types="node" />
import EventEmitter from 'events';
import * as grpc from '@grpc/grpc-js';
import { google, Ydb } from 'ydb-sdk-proto';
import { AuthenticatedService, ClientOptions } from './utils';
import DiscoveryService, { Endpoint } from './discovery';
import { IPoolSettings } from './driver';
import { ISslCredentials } from './ssl-credentials';
import { IAuthService } from './credentials';
import { Logger } from './logging';
import TableService = Ydb.Table.V1.TableService;
import ICreateSessionResult = Ydb.Table.ICreateSessionResult;
import IType = Ydb.IType;
import DescribeTableResult = Ydb.Table.DescribeTableResult;
import PrepareQueryResult = Ydb.Table.PrepareQueryResult;
import ExecuteQueryResult = Ydb.Table.ExecuteQueryResult;
import ExplainQueryResult = Ydb.Table.ExplainQueryResult;
import ITransactionSettings = Ydb.Table.ITransactionSettings;
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
export declare class SessionService extends AuthenticatedService<TableService> {
    endpoint: Endpoint;
    private readonly logger;
    constructor(endpoint: Endpoint, database: string, authService: IAuthService, logger: Logger, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions);
    create(): Promise<Session>;
}
interface IExistingTransaction {
    txId: string;
}
interface INewTransaction {
    beginTx: ITransactionSettings;
    commitTx: boolean;
}
export declare const AUTO_TX: INewTransaction;
interface IQueryParams {
    [k: string]: Ydb.ITypedValue;
}
export declare class OperationParams implements Ydb.Operations.IOperationParams {
    operationMode?: OperationMode;
    operationTimeout?: google.protobuf.IDuration;
    cancelAfter?: google.protobuf.IDuration;
    labels?: {
        [k: string]: string;
    };
    reportCostInfo?: Ydb.FeatureFlag.Status;
    withSyncMode(): this;
    withAsyncMode(): this;
    withOperationTimeout(duration: google.protobuf.IDuration): this;
    withOperationTimeoutSeconds(seconds: number): this;
    withCancelAfter(duration: google.protobuf.IDuration): this;
    withCancelAfterSeconds(seconds: number): this;
    withLabels(labels: {
        [k: string]: string;
    }): this;
    withReportCostInfo(): this;
}
export declare class OperationParamsSettings {
    operationParams?: OperationParams;
    withOperationParams(operationParams: OperationParams): this;
}
export declare class CreateTableSettings extends OperationParamsSettings {
}
export declare class AlterTableSettings extends OperationParamsSettings {
}
interface IDropTableSettings {
    muteNonExistingTableErrors: boolean;
}
export declare class DropTableSettings extends OperationParamsSettings {
    muteNonExistingTableErrors: boolean;
    constructor({ muteNonExistingTableErrors }?: IDropTableSettings);
}
export declare class DescribeTableSettings extends OperationParamsSettings {
    includeShardKeyBounds?: boolean;
    includeTableStats?: boolean;
    includePartitionStats?: boolean;
    withIncludeShardKeyBounds(includeShardKeyBounds: boolean): this;
    withIncludeTableStats(includeTableStats: boolean): this;
    withIncludePartitionStats(includePartitionStats: boolean): this;
}
export declare class BeginTransactionSettings extends OperationParamsSettings {
}
export declare class CommitTransactionSettings extends OperationParamsSettings {
    collectStats?: Ydb.Table.QueryStatsCollection.Mode;
    withCollectStats(collectStats: Ydb.Table.QueryStatsCollection.Mode): this;
}
export declare class RollbackTransactionSettings extends OperationParamsSettings {
}
export declare class PrepareQuerySettings extends OperationParamsSettings {
}
export declare class ExecuteQuerySettings extends OperationParamsSettings {
    keepInCache: boolean;
    collectStats?: Ydb.Table.QueryStatsCollection.Mode;
    onResponseMetadata?: (metadata: grpc.Metadata) => void;
    withKeepInCache(keepInCache: boolean): this;
    withCollectStats(collectStats: Ydb.Table.QueryStatsCollection.Mode): this;
}
export declare class BulkUpsertSettings extends OperationParamsSettings {
}
export declare class ReadTableSettings {
    columns?: string[];
    ordered?: boolean;
    rowLimit?: number;
    keyRange?: Ydb.Table.IKeyRange;
    withRowLimit(rowLimit: number): this;
    withColumns(...columns: string[]): this;
    withOrdered(ordered: boolean): this;
    withKeyRange(keyRange: IKeyRange): this;
    withKeyGreater(value: ITypedValue): this;
    withKeyGreaterOrEqual(value: ITypedValue): this;
    withKeyLess(value: ITypedValue): this;
    withKeyLessOrEqual(value: ITypedValue): this;
    private getOrInitKeyRange;
}
export declare class ExecuteScanQuerySettings {
    mode?: Ydb.Table.ExecuteScanQueryRequest.Mode;
    collectStats?: Ydb.Table.QueryStatsCollection.Mode;
    withMode(mode: Ydb.Table.ExecuteScanQueryRequest.Mode): this;
    withCollectStats(collectStats: Ydb.Table.QueryStatsCollection.Mode): this;
}
export declare class Session extends EventEmitter implements ICreateSessionResult {
    private api;
    endpoint: Endpoint;
    sessionId: string;
    private logger;
    private getResponseMetadata;
    private beingDeleted;
    private free;
    private closing;
    constructor(api: TableService, endpoint: Endpoint, sessionId: string, logger: Logger, getResponseMetadata: (request: object) => grpc.Metadata | undefined);
    acquire(): this;
    release(): void;
    isFree(): boolean;
    isClosing(): boolean;
    isDeleted(): boolean;
    delete(): Promise<void>;
    keepAlive(): Promise<void>;
    createTable(tablePath: string, description: TableDescription, settings?: CreateTableSettings): Promise<void>;
    alterTable(tablePath: string, description: AlterTableDescription, settings?: AlterTableSettings): Promise<void>;
    dropTable(tablePath: string, settings?: DropTableSettings): Promise<void>;
    describeTable(tablePath: string, settings?: DescribeTableSettings): Promise<DescribeTableResult>;
    describeTableOptions(settings?: DescribeTableSettings): Promise<Ydb.Table.DescribeTableOptionsResult>;
    beginTransaction(txSettings: ITransactionSettings, settings?: BeginTransactionSettings): Promise<ITransactionMeta>;
    commitTransaction(txControl: IExistingTransaction, settings?: CommitTransactionSettings): Promise<void>;
    rollbackTransaction(txControl: IExistingTransaction, settings?: RollbackTransactionSettings): Promise<void>;
    prepareQuery(queryText: string, settings?: PrepareQuerySettings): Promise<PrepareQueryResult>;
    executeQuery(query: PrepareQueryResult | string, params?: IQueryParams, txControl?: IExistingTransaction | INewTransaction, settings?: ExecuteQuerySettings): Promise<ExecuteQueryResult>;
    private processResponseMetadata;
    bulkUpsert(tablePath: string, rows: TypedValue, settings?: BulkUpsertSettings): Promise<BulkUpsertResult>;
    streamReadTable(tablePath: string, consumer: (result: Ydb.Table.ReadTableResult) => void, settings?: ReadTableSettings): Promise<void>;
    streamExecuteScanQuery(query: PrepareQueryResult | string, consumer: (result: ExecuteScanQueryPartialResult) => void, params?: IQueryParams, settings?: ExecuteScanQuerySettings): Promise<void>;
    private executeStreamRequest;
    explainQuery(query: string, operationParams?: Ydb.Operations.IOperationParams): Promise<ExplainQueryResult>;
}
declare type SessionCallback<T> = (session: Session) => Promise<T>;
interface ITableClientSettings {
    database: string;
    authService: IAuthService;
    sslCredentials?: ISslCredentials;
    poolSettings?: IPoolSettings;
    clientOptions?: ClientOptions;
    discoveryService: DiscoveryService;
    logger: Logger;
}
export declare class SessionPool extends EventEmitter {
    private readonly database;
    private readonly authService;
    private readonly sslCredentials?;
    private readonly clientOptions?;
    private readonly minLimit;
    private readonly maxLimit;
    private readonly sessions;
    private readonly sessionCreators;
    private readonly discoveryService;
    private newSessionsRequested;
    private sessionsBeingDeleted;
    private readonly sessionKeepAliveId;
    private readonly logger;
    private readonly waiters;
    private static SESSION_MIN_LIMIT;
    private static SESSION_MAX_LIMIT;
    constructor(settings: ITableClientSettings);
    destroy(): Promise<void>;
    private initListeners;
    private prepopulateSessions;
    private getSessionCreator;
    private maybeUseSession;
    private createSession;
    private deleteSession;
    private acquire;
    private _withSession;
    withSession<T>(callback: SessionCallback<T>, timeout?: number): Promise<T>;
    withSessionRetry<T>(callback: SessionCallback<T>, timeout?: number, maxRetries?: number): Promise<T>;
}
export declare class TableClient extends EventEmitter {
    private pool;
    constructor(settings: ITableClientSettings);
    withSession<T>(callback: (session: Session) => Promise<T>, timeout?: number): Promise<T>;
    withSessionRetry<T>(callback: (session: Session) => Promise<T>, timeout?: number, maxRetries?: number): Promise<T>;
    destroy(): Promise<void>;
}
export declare class Column implements Ydb.Table.IColumnMeta {
    name: string;
    type: IType;
    family?: string | undefined;
    constructor(name: string, type: IType, family?: string | undefined);
}
export declare class StorageSettings implements Ydb.Table.IStoragePool {
    media: string;
    constructor(media: string);
}
export declare class ColumnFamilyPolicy implements Ydb.Table.IColumnFamilyPolicy {
    name?: string;
    data?: StorageSettings;
    external?: StorageSettings;
    keepInMemory?: FeatureFlag;
    compression?: Compression;
    withName(name: string): this;
    withData(data: StorageSettings): this;
    withExternal(external: StorageSettings): this;
    withKeepInMemory(keepInMemory: FeatureFlag): this;
    withCompression(compression: Compression): this;
}
export declare class StoragePolicy implements Ydb.Table.IStoragePolicy {
    presetName?: string;
    syslog?: StorageSettings;
    log?: StorageSettings;
    data?: StorageSettings;
    external?: StorageSettings;
    keepInMemory?: FeatureFlag;
    columnFamilies: ColumnFamilyPolicy[];
    withPresetName(presetName: string): this;
    withSyslog(syslog: StorageSettings): this;
    withLog(log: StorageSettings): this;
    withData(data: StorageSettings): this;
    withExternal(external: StorageSettings): this;
    withKeepInMemory(keepInMemory: FeatureFlag): this;
    withColumnFamilies(...columnFamilies: ColumnFamilyPolicy[]): this;
}
export declare class ExplicitPartitions implements Ydb.Table.IExplicitPartitions {
    splitPoints: ITypedValue[];
    constructor(splitPoints: ITypedValue[]);
}
export declare class PartitioningPolicy implements Ydb.Table.IPartitioningPolicy {
    presetName?: string;
    autoPartitioning?: AutoPartitioningPolicy;
    uniformPartitions?: number;
    explicitPartitions?: ExplicitPartitions;
    withPresetName(presetName: string): this;
    withUniformPartitions(uniformPartitions: number): this;
    withAutoPartitioning(autoPartitioning: AutoPartitioningPolicy): this;
    withExplicitPartitions(explicitPartitions: ExplicitPartitions): this;
}
export declare class ReplicationPolicy implements Ydb.Table.IReplicationPolicy {
    presetName?: string;
    replicasCount?: number;
    createPerAvailabilityZone?: FeatureFlag;
    allowPromotion?: FeatureFlag;
    withPresetName(presetName: string): this;
    withReplicasCount(replicasCount: number): this;
    withCreatePerAvailabilityZone(createPerAvailabilityZone: FeatureFlag): this;
    withAllowPromotion(allowPromotion: FeatureFlag): this;
}
export declare class CompactionPolicy implements Ydb.Table.ICompactionPolicy {
    presetName: string;
    constructor(presetName: string);
}
export declare class ExecutionPolicy implements Ydb.Table.IExecutionPolicy {
    presetName: string;
    constructor(presetName: string);
}
export declare class CachingPolicy implements Ydb.Table.ICachingPolicy {
    presetName: string;
    constructor(presetName: string);
}
export declare class TableProfile implements Ydb.Table.ITableProfile {
    presetName?: string;
    storagePolicy?: StoragePolicy;
    compactionPolicy?: CompactionPolicy;
    partitioningPolicy?: PartitioningPolicy;
    executionPolicy?: ExecutionPolicy;
    replicationPolicy?: ReplicationPolicy;
    cachingPolicy?: CachingPolicy;
    withPresetName(presetName: string): this;
    withStoragePolicy(storagePolicy: StoragePolicy): this;
    withCompactionPolicy(compactionPolicy: CompactionPolicy): this;
    withPartitioningPolicy(partitioningPolicy: PartitioningPolicy): this;
    withExecutionPolicy(executionPolicy: ExecutionPolicy): this;
    withReplicationPolicy(replicationPolicy: ReplicationPolicy): this;
    withCachingPolicy(cachingPolicy: CachingPolicy): this;
}
export declare class TableIndex implements Ydb.Table.ITableIndex {
    name: string;
    indexColumns: string[];
    dataColumns: string[] | null;
    globalIndex: Ydb.Table.IGlobalIndex | null;
    globalAsyncIndex: Ydb.Table.IGlobalAsyncIndex | null;
    constructor(name: string);
    withIndexColumns(...indexColumns: string[]): this;
    /** Adds [covering index](https://ydb.tech/en/docs/concepts/secondary_indexes#covering) over columns */
    withDataColumns(...dataColumns: string[]): this;
    withGlobalAsync(isAsync: boolean): this;
}
export declare class TtlSettings implements Ydb.Table.ITtlSettings {
    dateTypeColumn?: Ydb.Table.IDateTypeColumnModeSettings | null;
    constructor(columnName: string, expireAfterSeconds?: number);
}
export declare class TableDescription implements Ydb.Table.ICreateTableRequest {
    columns: Column[];
    primaryKey: string[];
    /** @deprecated use TableDescription options instead */
    profile?: TableProfile;
    indexes: TableIndex[];
    ttlSettings?: TtlSettings;
    partitioningSettings?: Ydb.Table.IPartitioningSettings;
    uniformPartitions?: number;
    columnFamilies?: Ydb.Table.IColumnFamily[];
    attributes?: {
        [k: string]: string;
    };
    compactionPolicy?: 'default' | 'small_table' | 'log_table';
    keyBloomFilter?: FeatureFlag;
    partitionAtKeys?: Ydb.Table.IExplicitPartitions;
    readReplicasSettings?: Ydb.Table.IReadReplicasSettings;
    storageSettings?: Ydb.Table.IStorageSettings;
    constructor(columns?: Column[], primaryKey?: string[]);
    withColumn(column: Column): this;
    withColumns(...columns: Column[]): this;
    withPrimaryKey(key: string): this;
    withPrimaryKeys(...keys: string[]): this;
    /** @deprecated use TableDescription options instead */
    withProfile(profile: TableProfile): this;
    withIndex(index: TableIndex): this;
    withIndexes(...indexes: TableIndex[]): this;
    withTtl(columnName: string, expireAfterSeconds?: number): this;
    withPartitioningSettings(partitioningSettings: Ydb.Table.IPartitioningSettings): void;
}
export declare class AlterTableDescription {
    addColumns: Column[];
    dropColumns: string[];
    alterColumns: Column[];
    setTtlSettings?: TtlSettings;
    dropTtlSettings?: {};
    addIndexes: TableIndex[];
    dropIndexes: string[];
    alterStorageSettings?: Ydb.Table.IStorageSettings;
    addColumnFamilies?: Ydb.Table.IColumnFamily[];
    alterColumnFamilies?: Ydb.Table.IColumnFamily[];
    alterAttributes?: {
        [k: string]: string;
    };
    setCompactionPolicy?: string;
    alterPartitioningSettings?: Ydb.Table.IPartitioningSettings;
    setKeyBloomFilter?: Ydb.FeatureFlag.Status;
    setReadReplicasSettings?: Ydb.Table.IReadReplicasSettings;
    addChangefeeds?: Ydb.Table.IChangefeed[];
    dropChangefeeds?: string[];
    renameIndexes?: Ydb.Table.IRenameIndexItem[];
    constructor();
    withAddColumn(column: Column): this;
    withDropColumn(columnName: string): this;
    withAlterColumn(column: Column): this;
    withSetTtl(columnName: string, expireAfterSeconds?: number): this;
    withDropTtl(): this;
}
export {};
