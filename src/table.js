const path = require('path');
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const _ = require('lodash');
const EventEmitter = require('events');
const {decodeMessage, SERVICE_PROTO_DIR, LOADER_OPTS} = require('./utils');
const {getCredentialsMetadata} = require('./credentials');

const packageDefinition = protoLoader.loadSync(
    path.join(SERVICE_PROTO_DIR, 'ydb_table_v1.proto'),
    LOADER_OPTS
);
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const {TableService} = protoDescriptor.Ydb.Table.V1;

function _getClient(endpoint) {
    const entryPoint = `${endpoint.info.address}:${endpoint.info.port}`;
    return new TableService(entryPoint, grpc.credentials.createInsecure());
}
const getClient = _.memoize(_getClient);

const STATUS = {
    SUCCESS: 'SUCCESS'
};

class EndpointAwareEntity extends EventEmitter {
    constructor(endpoint) {
        super();
        this.endpoint = endpoint;
    }

    _performAsyncOp(methodName, args = {}, debug) {
        return new Promise((resolve, reject) => {
            const client = getClient(this.endpoint);
            const metadata = getCredentialsMetadata();
            client[methodName](args, metadata, (err, response) => {
                if (err) {
                    reject(err);
                } else {
                    const {status, result, issues} = response.operation;
                    if (status === STATUS.SUCCESS) {
                        if (result === null) {
                            resolve();
                            return;
                        }
                        try {
                            const {type_url, value} = result;
                            resolve(decodeMessage(type_url, value));
                        } catch (err) {
                            reject(err);
                        }
                    } else {
                        reject({status, issues});
                    }
                }
            });
        });
    }
}

class Column {
    constructor(name, type) {
        this.name = name;
        this.type = type;
    }
}

class TableDescription {
    constructor() {
        this.columns = [];
        this.primaryKeys = [];
    }

    withColumn(column) {
        this.columns.push(column);
        return this;
    }

    withPrimaryKey(key) {
        this.primaryKeys.push(key);
        return this;
    }

    withPrimaryKeys(...keys) {
        for (const key of keys) {
            this.primaryKeys.push(key);
        }
        return this;
    }
}

class Session extends EndpointAwareEntity {
    constructor(endpoint, sessionId) {
        super(endpoint);
        this.id = sessionId;
        this._beingDeleted = false;
        this._free = true;
    }

    acquire() {
        this._free = false;
        return this;
    }
    release() {
        this._free = true;
    }
    isFree() {
        return this._free && !this._beingDeleted;
    }

    with() {

    }

    markForDeletion() {
        this._beingDeleted = true;
    }

    keepAlive() {
        return this._performAsyncOp('KeepAlive', {session_id: this.id});
    }

    createTable(tablePath, description) {
        return this._performAsyncOp('CreateTable', {
            session_id: this.id,
            path: `${this.endpoint.database}/${tablePath}`,
            columns: description.columns,
            primary_key: description.primaryKeys
        });
    }

    dropTable(tablePath) {
        return this._performAsyncOp('DropTable', {
            session_id: this.id,
            path: `${this.endpoint.database}/${tablePath}`
        });
    }

    describeTable(tablePath) {
        return this._performAsyncOp('DescribeTable', {
            session_id: this.id,
            path: `${this.endpoint.database}/${tablePath}`
        }, true);
    }


}

class SessionPool extends EndpointAwareEntity {
    constructor(endpoint, minLimit = 5, maxLimit = 20) {
        super(endpoint);
        this.minLimit = minLimit;
        this.maxLimit = maxLimit;
        this.sessions = new Set();
        this.newSessionsRequested = 0;
        this.sessionsBeingDeleted = 0;
        this._prepopulateSessions();
        this._initListeners();
    }

    _initListeners() {
        this.on(SessionPool.SESSION_BROKEN, (sessionId) => {
            this._deleteSession(sessionId);
        })
    }

    _prepopulateSessions() {
        for (const index of _.range(this.minLimit)) {
            this._createSession();
        }
    }

    _createSession() {
        return this._performAsyncOp('CreateSession')
            .then(({sessionId}) => {
                const session = new Session(this.endpoint, sessionId);
                this.sessions.add(session);
                return session
            })
    }
    _deleteSession(session) {
        session.markForDeletion();
        this.sessionsBeingDeleted++;
        return this._performAsyncOp('DeleteSession', {session_id: session.id})
            .then(() => {
                this.sessions.delete(session);
                this.sessionsBeingDeleted--;
            });
    }

    acquire(timeout = 0) {
        for (const session of this.sessions) {
            if (session.isFree()) {
                session.acquire();
                return Promise.resolve(session);
            }
        }

        if (this.sessions.size + this.newSessionsRequested - this.sessionsBeingDeleted <= this.maxLimit) {
            this.newSessionsRequested++;
            return this._createSession()
                .then((session) => {
                    this.newSessionsRequested--;
                    session.acquire();
                    return session;
                })
        } else {
            return new Promise((resolve, reject) => {
                let timeoutId;
                if (timeout) {
                    timeoutId = setTimeout(() => {
                        reject(`No session became available within timeout of ${timeout} ms`);
                    }, timeout);
                }
                this.once(SessionPool.SESSION_RELEASED, (session) => {
                    clearTimeout(timeoutId);
                    resolve(session);
                })
            });
        }
    }
    release(session) {
        session.release();
        this.emit(SessionPool.SESSION_RELEASED, session);
    }
    withSession(callback, timeout) {
        return this.acquire(timeout)
            .then((session) => {
                return Promise.resolve(callback(session))
                    .then(() => this.release(session));
            });
    }
}
SessionPool.SESSION_RELEASED = 'sessionReleased';
SessionPool.SESSION_BROKEN = 'badSession';

module.exports = {
    SessionPool,
    TableDescription,
    Column
};
