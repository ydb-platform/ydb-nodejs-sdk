import _ from 'lodash';
import EventEmitter from 'events';
import {Ydb} from '../proto/bundle';
import {AuthenticatedService, ensureOperationSucceeded, getOperationPayload, pessimizable} from './utils';
import {Endpoint} from './discovery';
import Driver from './driver';
import {SESSION_KEEPALIVE_PERIOD} from './constants';
import {IAuthService} from './credentials';
import getLogger, {Logger} from './logging';
import {retryable} from './retries';
import {SchemeError, SessionPoolEmpty, BadSession, SessionBusy} from './errors';

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
import IOperationParams = Ydb.Operations.IOperationParams;


export class SessionService extends AuthenticatedService<TableService> {
    public endpoint: Endpoint;
    private readonly logger: Logger;

    constructor(endpoint: Endpoint, authService: IAuthService) {
        const host = endpoint.toString();
        super(host, 'Ydb.Table.V1.TableService', TableService, authService);
        this.endpoint = endpoint;
        this.logger = getLogger();
    }

    @retryable()
    @pessimizable
    async create(): Promise<Session> {
        const response = await this.api.createSession(CreateSessionRequest.create());
        const payload = getOperationPayload(response);
        const {sessionId} = CreateSessionResult.decode(payload);
        return new Session(this.api, this.endpoint, sessionId, this.logger);
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

const AUTO_TX: INewTransaction = {
    beginTx: {
        serializableReadWrite: {}
    },
    commitTx: true
};

interface IQueryParams {
    [k: string]: Ydb.ITypedValue
}

export class ExecDataQuerySettings {
    keepInCache: boolean = false;

    withKeepInCache(keepInCache: boolean) {
        this.keepInCache = keepInCache;
        return this;
    }
}

export class Session extends EventEmitter implements ICreateSessionResult {
    private beingDeleted = false;
    private free = true;

    constructor(private api: TableService, public endpoint: Endpoint, public sessionId: string, private logger: Logger) {
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
        ensureOperationSucceeded(await this.api.keepAlive({sessionId: this.sessionId}));
    }

    @retryable()
    @pessimizable
    public async createTable(tablePath: string, description: TableDescription, operationParams?: IOperationParams): Promise<void> {
        const {columns, primaryKey, indexes, profile, ttlSettings} = description;
        const request: Ydb.Table.ICreateTableRequest = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
            columns,
            primaryKey,
            indexes,
            profile,
            ttlSettings,
            operationParams,
        };
        ensureOperationSucceeded(await this.api.createTable(request));
    }

    @retryable()
    @pessimizable
    public async alterTable(tablePath: string, description: AlterTableDescription, operationParams?: IOperationParams): Promise<void> {
        const {addColumns, dropColumns, alterColumns, setTtlSettings, dropTtlSettings} = description;
        const request: Ydb.Table.IAlterTableRequest = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
            addColumns,
            dropColumns,
            alterColumns,
            setTtlSettings,
            dropTtlSettings,

            operationParams,
        };
        ensureOperationSucceeded(await this.api.alterTable(request));
    }

    @retryable()
    @pessimizable
    public async dropTable(tablePath: string, operationParams?: IOperationParams): Promise<void> {
        const request: Ydb.Table.IDropTableRequest = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
            operationParams,
        };
        // suppress error when dropping non-existent table
        ensureOperationSucceeded(await this.api.dropTable(request), [SchemeError.status]);
    }

    @retryable()
    @pessimizable
    public async describeTable(tablePath: string, operationParams?: IOperationParams): Promise<DescribeTableResult> {
        const request: Ydb.Table.IDescribeTableRequest = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
            operationParams,
        };
        const response = await this.api.describeTable(request);
        const payload = getOperationPayload(response);
        return DescribeTableResult.decode(payload);
    }

    @retryable()
    @pessimizable
    public async beginTransaction(txSettings: ITransactionSettings, operationParams?: IOperationParams): Promise<ITransactionMeta> {
        const response = await this.api.beginTransaction({
            sessionId: this.sessionId,
            txSettings,
            operationParams,
        });
        const payload = getOperationPayload(response);
        const {txMeta} = BeginTransactionResult.decode(payload);
        if (txMeta) {
            return txMeta;
        }
        throw new Error('Could not begin new transaction, txMeta is empty!');
    }

    @retryable()
    @pessimizable
    public async commitTransaction(txControl: IExistingTransaction, operationParams?: IOperationParams): Promise<void> {
        const request: Ydb.Table.ICommitTransactionRequest = {
            sessionId: this.sessionId,
            txId: txControl.txId,
            operationParams,
        };
        ensureOperationSucceeded(await this.api.commitTransaction(request));
    }

    @retryable()
    @pessimizable
    public async rollbackTransaction(txControl: IExistingTransaction, operationParams?: IOperationParams): Promise<void> {
        const request: Ydb.Table.IRollbackTransactionRequest = {
            sessionId: this.sessionId,
            txId: txControl.txId,
            operationParams,
        };
        ensureOperationSucceeded(await this.api.rollbackTransaction(request));
    }

    @retryable()
    @pessimizable
    public async prepareQuery(queryText: string, operationParams?: IOperationParams): Promise<PrepareQueryResult> {
        const request: Ydb.Table.IPrepareDataQueryRequest = {
            sessionId: this.sessionId,
            yqlText: queryText,
            operationParams,
        };
        const response = await this.api.prepareDataQuery(request);
        const payload = getOperationPayload(response);
        return PrepareQueryResult.decode(payload);
    }

    @pessimizable
    public async executeQuery(
        query: PrepareQueryResult | string,
        params: IQueryParams = {},
        txControl: IExistingTransaction | INewTransaction = AUTO_TX,
        operationParams?: IOperationParams,
        settings?: ExecDataQuerySettings,
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
            operationParams,
        };
        if (keepInCache) {
            request.queryCachePolicy = {keepInCache};
        }
        const response = await this.api.executeDataQuery(request);
        const payload = getOperationPayload(response);
        return ExecuteQueryResult.decode(payload);
    }
}

export interface PoolSettings {
    minLimit?: number;
    maxLimit?: number;
    keepAlivePeriod?: number;
}

type SessionCallback<T> = (session: Session) => Promise<T>;

export class SessionPool extends EventEmitter {
    private readonly minLimit: number;
    private readonly maxLimit: number;
    private readonly sessions: Set<Session>;
    private newSessionsRequested: number;
    private sessionsBeingDeleted: number;
    private readonly sessionKeepAliveId: NodeJS.Timeout;
    private readonly logger: Logger;
    private readonly waiters: ((session: Session) => void)[] = [];

    private static SESSION_MIN_LIMIT = 5;
    private static SESSION_MAX_LIMIT = 20;

    constructor(private driver: Driver) {
        super();
        const poolSettings = driver.settings?.poolSettings;
        this.minLimit = poolSettings?.minLimit || SessionPool.SESSION_MIN_LIMIT;
        this.maxLimit = poolSettings?.maxLimit || SessionPool.SESSION_MAX_LIMIT;
        this.sessions = new Set();
        this.newSessionsRequested = 0;
        this.sessionsBeingDeleted = 0;
        this.prepopulateSessions();
        this.sessionKeepAliveId = this.initListeners(poolSettings?.keepAlivePeriod || SESSION_KEEPALIVE_PERIOD);
        this.logger = getLogger();
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

    private async createSession(): Promise<Session> {
        const sessionCreator = await this.driver.getSessionCreator();
        const session = await sessionCreator.create();
        session.on(SessionEvent.SESSION_RELEASE, () => {
            if (this.waiters.length > 0) {
                const waiter = this.waiters.shift();
                if (typeof waiter === "function") {
                    waiter(session);
                }
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

    constructor(driver: Driver) {
        super();
        this.pool = new SessionPool(driver);
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
    constructor(public name: string, public type: IType) {}
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

    constructor(public name: string) {}

    withIndexColumns(...indexColumns: string[]) {
        for (const index of indexColumns) {
            this.indexColumns.push(index);
        }
        return this;
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
