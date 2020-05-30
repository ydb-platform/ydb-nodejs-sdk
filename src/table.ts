import _ from 'lodash';
import EventEmitter from 'events';
import {Ydb} from "../proto/bundle";
import {BaseService, ensureOperationSucceeded, getOperationPayload, pessimizable} from "./utils";
import {Endpoint} from './discovery';
import Driver from "./driver";
import {SESSION_KEEPALIVE_PERIOD} from "./constants";
import {IAuthService} from "./credentials";
import getLogger, {Logger} from './logging';
import {retryable} from "./retries";
import {SchemeError} from "./errors";

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


export class SessionService extends BaseService<TableService> {
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
    public async createTable(tablePath: string, description: TableDescription): Promise<void> {
        const {columns, primaryKey, indexes, profile} = description;
        const request = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
            columns,
            primaryKey,
            indexes,
            profile
        };
        ensureOperationSucceeded(await this.api.createTable(request));
    }

    @retryable()
    @pessimizable
    public async dropTable(tablePath: string): Promise<void> {
        const request = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`
        };
        // suppress error when dropping non-existent table
        ensureOperationSucceeded(await this.api.dropTable(request), [SchemeError.status]);
    }

    @retryable()
    @pessimizable
    public async describeTable(tablePath: string): Promise<DescribeTableResult> {
        const request = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`
        };
        const response = await this.api.describeTable(request);
        const payload = getOperationPayload(response);
        return DescribeTableResult.decode(payload);
    }

    @retryable()
    @pessimizable
    public async beginTransaction(txSettings: ITransactionSettings): Promise<ITransactionMeta> {
        const response = await this.api.beginTransaction({
            sessionId: this.sessionId,
            txSettings
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
    public async commitTransaction(txControl: IExistingTransaction): Promise<void> {
        const request = {
            sessionId: this.sessionId,
            txId: txControl.txId
        };
        ensureOperationSucceeded(await this.api.commitTransaction(request));
    }

    @retryable()
    @pessimizable
    public async rollbackTransaction(txControl: IExistingTransaction): Promise<void> {
        const request = {
            sessionId: this.sessionId,
            txId: txControl.txId
        };
        ensureOperationSucceeded(await this.api.rollbackTransaction(request));
    }

    @retryable()
    @pessimizable
    public async prepareQuery(queryText: string): Promise<PrepareQueryResult> {
        const request = {
            sessionId: this.sessionId,
            yqlText: queryText
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
        operationParams?: Ydb.Operations.IOperationParams,
    ): Promise<ExecuteQueryResult> {
        this.logger.trace('preparedQuery', JSON.stringify(query, null, 2));
        this.logger.trace('parameters', JSON.stringify(params, null, 2));
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
        const request = {
            sessionId: this.sessionId,
            txControl,
            parameters: params,
            query: queryToExecute,
            operationParams: operationParams,
        };
        const response = await this.api.executeDataQuery(request);
        const payload = getOperationPayload(response);
        return ExecuteQueryResult.decode(payload);
    }
}

export class SessionPool extends EventEmitter {
    private readonly minLimit: number;
    private readonly maxLimit: number;
    private readonly sessions: Set<Session>;
    private newSessionsRequested: number;
    private sessionsBeingDeleted: number;
    private readonly sessionKeepAliveId: NodeJS.Timeout;
    private readonly logger: Logger;
    private readonly waiters: ((session: Session) => void)[] = [];

    constructor(private driver: Driver, minLimit = 5, maxLimit = 20, keepAlivePeriod = SESSION_KEEPALIVE_PERIOD) {
        super();
        this.minLimit = minLimit;
        this.maxLimit = maxLimit;
        this.sessions = new Set();
        this.newSessionsRequested = 0;
        this.sessionsBeingDeleted = 0;
        this.prepopulateSessions();
        this.sessionKeepAliveId = this.initListeners(keepAlivePeriod);
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
            _.map([...this.sessions], (session: Session) => session.keepAlive())
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

    private async deleteSession(session: Session) {
        if (!session.isDeleted()) {
            this.sessionsBeingDeleted++;
            session.delete()
                .then(() => {
                    this.sessions.delete(session);
                    this.sessionsBeingDeleted--;
                });
        }
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
                    this.newSessionsRequested--;
                    return session.acquire();
                })
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
                        reject(`No session became available within timeout of ${timeout} ms`);
                    }, timeout);
                }
                this.waiters.push(waiter);
            });
        }
    }

    public async withSession(callback: (session: Session) => Promise<any>, timeout: number = 0): Promise<any> {
        const session = await this.acquire(timeout);
        try {
            const result = await callback(session);
            session.release();
            return result;
        } catch (error) {
            await this.deleteSession(session);
            throw error;
            // TODO: add retry machinery here
        }
    }
}

export class TableClient extends EventEmitter {
    private pool: SessionPool;

    constructor(driver: Driver) {
        super();
        this.pool = new SessionPool(driver);
    }

    public async withSession(callback: (session: Session) => Promise<any>, timeout: number = 0): Promise<any> {
        return this.pool.withSession(callback, timeout);
    }

    public async destroy() {
        await this.pool.destroy();
    }
}

export class Column implements Ydb.Table.IColumnMeta {
    constructor(public name: string, public type: IType) {}
}

export class StorageSettings implements Ydb.Table.IStorageSettings {
    constructor(public storageKind: string) {}
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

export class TableDescription {
    public profile?: TableProfile;
    public indexes: TableIndex[] = [];

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
}
