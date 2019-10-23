import _ from 'lodash';
import EventEmitter from 'events';
import {Ydb} from "../proto/bundle";
import {ServiceFactory, BaseService, getOperationPayload} from "./utils";
import {Endpoint} from './discovery';

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


class SessionService extends BaseService<TableService, ServiceFactory<TableService>> {
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

export class Session extends EventEmitter implements ICreateSessionResult {
    private beingDeleted = false;
    private free = true;

    constructor(private api: TableService, private endpoint: Endpoint, public sessionId: string) {
        super();
    }

    acquire() {
        this.free = false;
        return this;
    }
    release() {
        this.free = true;
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

    executeQuery(preparedQuery: IQuery, parameters: {[k: string]: Ydb.ITypedValue} = {}) {
        // console.log('preparedQuery', JSON.stringify(preparedQuery, null, 2));
        // console.log('parameters', JSON.stringify(parameters, null, 2));
        const request = {
            sessionId: this.sessionId,
            txControl: {
                beginTx: {
                    serializableReadWrite: {}
                },
                commitTx: true
            },
            parameters,
            query: {
                id: preparedQuery.id
            }
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
    private sessionService: SessionService;

    constructor(endpoint: Endpoint, minLimit = 5, maxLimit = 20) {
        super();
        this.minLimit = minLimit;
        this.maxLimit = maxLimit;
        this.sessions = new Set();
        this.newSessionsRequested = 0;
        this.sessionsBeingDeleted = 0;
        this.sessionService = new SessionService(endpoint);
        this.prepopulateSessions();
        this.initListeners();
    }

    private initListeners() {
        this.on(SessionEvent.SESSION_BROKEN, (sessionId) => {
            this.deleteSession(sessionId);
        })
    }

    private prepopulateSessions() {
        _.forEach(_.range(this.minLimit), () => this.createSession());
    }

    private async createSession(): Promise<Session> {
        const session = await this.sessionService.create();
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

    acquire(timeout: number = 0): Promise<Session> {
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

    withSession(callback: (session: Session) => void, timeout: number = 0): Promise<void> {
        return this.acquire(timeout)
            .then((session) => {
                return Promise.resolve(callback(session))
                    .then(() => session.release());
            });
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
