import _ from 'lodash';
import EventEmitter from 'events';
import {Ydb} from "../proto/bundle";
import {ServiceFactory, BaseService, getOperationPayload} from "./utils";
import {Endpoint} from './discovery';
import Driver from "./driver";
import {SESSION_KEEPALIVE_PERIOD} from "./constants";

import TableService = Ydb.Table.V1.TableService;
import CreateSessionRequest = Ydb.Table.CreateSessionRequest;
import ICreateSessionResult = Ydb.Table.ICreateSessionResult;
import CreateSessionResult = Ydb.Table.CreateSessionResult;
import DeleteSessionResponse = Ydb.Table.DeleteSessionResponse;
import IQuery = Ydb.Table.IQuery;
import IType = Ydb.IType;
import DescribeTableResult = Ydb.Table.DescribeTableResult;
import PrepareQueryResult = Ydb.Table.PrepareQueryResult;
import ExecuteQueryResult = Ydb.Table.ExecuteQueryResult;
import ITransactionSettings = Ydb.Table.ITransactionSettings;
import BeginTransactionResult = Ydb.Table.BeginTransactionResult;
import ITransactionMeta = Ydb.Table.ITransactionMeta;


export class SessionService extends BaseService<TableService, ServiceFactory<TableService>> {
    public endpoint: Endpoint;

    constructor(endpoint: Endpoint) {
        const host = endpoint.toString();
        super(host, 'Ydb.Table.V1.TableService', TableService);
        this.endpoint = endpoint;
    }

    async create(): Promise<Session> {
        const response = await this.api.createSession(CreateSessionRequest.create());
        const payload = getOperationPayload(response);
        const {sessionId} = CreateSessionResult.decode(payload);
        return new Session(this.api, this.endpoint, sessionId);
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

    constructor(private api: TableService, private endpoint: Endpoint, public sessionId: string) {
        super();
    }

    acquire() {
        this.free = false;
        console.log(`Acquired session ${this.sessionId} on endpoint ${this.endpoint.toString()}.`);
        return this;
    }
    release() {
        this.free = true;
        console.log(`Released session ${this.sessionId} on endpoint ${this.endpoint.toString()}.`);
        this.emit(SessionEvent.SESSION_RELEASE, this);
    }

    public isFree() {
        return this.free && !this.isDeleted();
    }
    public isDeleted() {
        return this.beingDeleted;
    }

    public async delete(): Promise<DeleteSessionResponse|null> {
        if (this.isDeleted()) {
            return Promise.resolve(null);
        }
        this.beingDeleted = true;
        return this.api.deleteSession({sessionId: this.sessionId});
    }

    public keepAlive() {
        return this.api.keepAlive({sessionId: this.sessionId});
    }

    createTable(tablePath: string, description: TableDescription) {
        return this.api.createTable({
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
            columns: description.columns,
            primaryKey: description.primaryKeys
        });
    }

    dropTable(tablePath: string) {
        return this.api.dropTable({
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`
        });
    }

    describeTable(tablePath: string) {
        const request = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`
        };
        return this.api.describeTable(request)
            .then((response) => {
                const payload = getOperationPayload(response);
                return DescribeTableResult.decode(payload);
            })
    }

    async beginTransaction(txSettings: ITransactionSettings): Promise<ITransactionMeta> {
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

    async commitTransaction(txControl: IExistingTransaction): Promise<Uint8Array> {
        const response = await this.api.commitTransaction({
            sessionId: this.sessionId,
            txId: txControl.txId
        });
        return getOperationPayload(response);
    }

    async rollbackTransaction(txControl: IExistingTransaction): Promise<Uint8Array> {
        const response = await this.api.rollbackTransaction({
            sessionId: this.sessionId,
            txId: txControl.txId
        });
        return getOperationPayload(response);
    }

    prepareQuery(queryText: string): Promise<PrepareQueryResult> {
        const request = {
            sessionId: this.sessionId,
            yqlText: queryText
        };
        return this.api.prepareDataQuery(request)
            .then((response) => {
                const payload = getOperationPayload(response);
                return PrepareQueryResult.decode(payload);
            })
    }

    executeQuery(query: IQuery | string, params: IQueryParams = {}, txControl: IExistingTransaction | INewTransaction = AUTO_TX) {
        // console.log('preparedQuery', JSON.stringify(preparedQuery, null, 2));
        // console.log('parameters', JSON.stringify(params, null, 2));
        if (typeof query === 'string') {
            query = {
                yqlText: query
            };
        }
        const request = {
            sessionId: this.sessionId,
            txControl,
            parameters: params,
            query
        };
        return this.api.executeDataQuery(request)
            .then((response) => {
                const payload = getOperationPayload(response);
                return ExecuteQueryResult.decode(payload);
            })
    }
}

export class SessionPool extends EventEmitter {
    private readonly minLimit: number;
    private readonly maxLimit: number;
    private readonly sessions: Set<Session>;
    private newSessionsRequested: number;
    private sessionsBeingDeleted: number;
    private readonly sessionKeepAliveId: NodeJS.Timeout;
    private driver: Driver;

    constructor(driver: Driver, minLimit = 5, maxLimit = 20, keepAlivePeriod = SESSION_KEEPALIVE_PERIOD) {
        super();
        this.minLimit = minLimit;
        this.maxLimit = maxLimit;
        this.sessions = new Set();
        this.newSessionsRequested = 0;
        this.sessionsBeingDeleted = 0;
        this.driver = driver;
        this.prepopulateSessions();
        this.sessionKeepAliveId = this.initListeners(keepAlivePeriod);
    }

    public async destroy(): Promise<void> {
        console.log('Destroying pool...');
        clearInterval(this.sessionKeepAliveId);
        await Promise.all(_.map([...this.sessions], (session) => this.deleteSession(session)));
        console.log('Pool has been destroyed.');
    }

    private initListeners(keepAlivePeriod: number) {
        this.on(SessionEvent.SESSION_BROKEN, async (sessionId) => {
            await this.deleteSession(sessionId);
        });
        return setInterval(async () => Promise.all(
            _.map([...this.sessions], (session) => session.keepAlive())
        ), keepAlivePeriod);
    }

    private prepopulateSessions() {
        _.forEach(_.range(this.minLimit), () => this.createSession());
    }

    private async createSession(): Promise<Session> {
        const sessionCreator = await this.driver.getSessionCreator();
        const session = await sessionCreator.create();
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
                if (timeout) {
                    timeoutId = setTimeout(() => {
                        reject(`No session became available within timeout of ${timeout} ms`);
                    }, timeout);
                }
                this.once(SessionEvent.SESSION_RELEASE, (session) => {
                    clearTimeout(timeoutId);
                    resolve(session);
                })
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
            // TODO: add retry machinery here
        }
    }
}

export class Column {
    constructor(public name: string, public type: IType) {}
}

export class TableDescription {
    constructor(public columns: Column[] = [], public primaryKeys: string[] = []) {}

    withColumn(column: Column) {
        this.columns.push(column);
        return this;
    }

    withPrimaryKey(key: string) {
        this.primaryKeys.push(key);
        return this;
    }

    withPrimaryKeys(...keys: string[]) {
        for (const key of keys) {
            this.primaryKeys.push(key);
        }
        return this;
    }
}
