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


class SessionPool extends EventEmitter {
    constructor(endpoint, minLimit = 5, maxLimit = 20) {
        super();
        this.endpoint = endpoint;
        this.minLimit = minLimit;
        this.maxLimit = maxLimit;
        this.freeSessions = {};
        this.newSessionsRequested = 0;
        this._prepopulateSessions();
        this._initListeners();
    }

    _initListeners() {
        this.on(SessionPool.SESSION_BROKEN, (sessionId) => {
            this._deleteSession(sessionId);
        })
    }

    _performAsyncOp(methodName, args = {}) {
        return new Promise((resolve, reject) => {
            const client = getClient(this.endpoint);
            const metadata = getCredentialsMetadata();
            client[methodName](args, metadata, (err, response) => {
                if (err) {
                    reject(err);
                } else {
                    try {
                        const {type_url, value} = response.operation.result;
                        const result = decodeMessage(type_url, value);
                        resolve(result);
                    } catch (err) {
                        reject(err);
                    }
                }
            });
        });
    }

    _prepopulateSessions() {
        for (const index of _.range(this.minLimit)) {
            this._createSession();
        }
    }

    _createSession() {
        return this._performAsyncOp('CreateSession')
            .then(({sessionId}) => {
                this.freeSessions[sessionId] = true;
                console.debug('Successfully created session', sessionId);
                return sessionId;
            })
    }
    _deleteSession(sessionId) {
        return this._performAsyncOp('DeleteSession', {session_id: sessionId})
            .then(() => {
                delete this.freeSessions[sessionId];
            });
    }

    acquire(timeout = 0) {
        for (const sessionId of this.freeSessions.keys()) {
            if (this.freeSessions[sessionId]) {
                this.freeSessions[sessionId] = false;
                return Promise.resolve(sessionId);
            }
        }

        if (this.freeSessions.keys().length + this.newSessionsRequested <= this.maxLimit) {
            this.newSessionsRequested++;
            return this._createSession()
                .then((sessionId) => {
                    this.newSessionsRequested--;
                    this.freeSessions[sessionId] = false;
                    return sessionId;
                })
        } else {
            return new Promise((resolve, reject) => {
                let timeoutId;
                if (timeout) {
                    timeoutId = setTimeout(() => {
                        reject(`No session became available within timeout of ${timeout} ms`);
                    }, timeout);
                }
                this.once(SessionPool.SESSION_RELEASED, (sessionId) => {
                    this.freeSessions[sessionId] = false;
                    clearTimeout(timeoutId);
                    resolve(sessionId);
                })
            });
        }
    }
    release(sessionId) {
        this.freeSessions[sessionId] = true;
        this.emit(SessionPool.SESSION_RELEASED, sessionId);
    }
    withSession(callback, timeout) {
        return this.acquire(timeout)
            .then((sessionId) => {
                return Promise.resolve(callback(sessionId))
                    .then(() => this.release(sessionId));
            });
    }
}
SessionPool.SESSION_RELEASED = 'sessionReleased';
SessionPool.SESSION_BROKEN = 'badSession';

module.exports = {
    SessionPool
};
