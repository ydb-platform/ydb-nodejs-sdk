import {Ydb} from 'ydb-sdk-proto';
import {IAuthService} from "../credentials";
import {ISslCredentials} from "../ssl-credentials";
import {IPoolSettings} from "../driver";
import DiscoveryService, {Endpoint} from "../discovery";
import {Logger} from "../logging";
import EventEmitter from "events";
import {Events, SESSION_KEEPALIVE_PERIOD} from "../constants";
import _ from "lodash";
import {BadSession, SessionBusy, SessionPoolEmpty} from "../errors";
import {retryable} from "../retries";
import {TableSession} from "./table-session";
import {SessionEvent} from "../utils/session-event";
import TableService = Ydb.Table.V1.TableService;
import CreateSessionRequest = Ydb.Table.CreateSessionRequest;
import CreateSessionResult = Ydb.Table.CreateSessionResult;
import {AuthenticatedService} from "./authenticated-service";
import {pessimizable} from "../utils/pessimizable";
import {getOperationPayload} from "./utils/get-operation-payload";
import {ClientOptions} from "../utils/client-options";

/**
 * Base class, for Ydb grpc services with authentication.
 *
 * This.api is the protobufs service interface, where the connection to a server
 * is made through the grpc-js client, which is provided to the protobufs through an implementation of rpcImpl.
 *
 * The limitation is that protobufs solves the issue of serializing and deserializing requests and responses
 * into binary form. But it has nothing for streams.  So services with streams are tricky to implement.  There is some
 * tricky solution for output steram - thru multiple call of result calllback in protobufs api.
 *
 * Instead of this class, it is recommended to use AuthenticatedClient, which returned by Endpoint class.
 */
// TODO: Make a use one grpc client per endpoint.  Right now new grpc client is generated for every instance of the service
export class TableSessionBuilder extends AuthenticatedService<TableService> {
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
    async create(): Promise<TableSession> {
        const response = await this.api.createSession(CreateSessionRequest.create());
        const payload = getOperationPayload(response);
        const {sessionId} = CreateSessionResult.decode(payload);
        return new TableSession(this.api, this.endpoint, sessionId, this.logger, this.getResponseMetadata.bind(this));
    }
}

type SessionCallback<T> = (session: TableSession) => Promise<T>;

interface ITableClientSettings {
    database: string;
    authService: IAuthService;
    sslCredentials?: ISslCredentials;
    poolSettings?: IPoolSettings;
    clientOptions?: ClientOptions;
    discoveryService: DiscoveryService;
    logger: Logger;
}

export class TableSessionsPool extends EventEmitter {
    private readonly database: string;
    private readonly authService: IAuthService;
    private readonly sslCredentials?: ISslCredentials;
    private readonly clientOptions?: ClientOptions;
    private readonly minLimit: number;
    private readonly maxLimit: number;
    private readonly sessions: Set<TableSession>;
    private readonly sessionCreators: Map<Endpoint, TableSessionBuilder>;
    private readonly discoveryService: DiscoveryService;
    private newSessionsRequested: number;
    private sessionsBeingDeleted: number;
    private readonly sessionKeepAliveId: NodeJS.Timeout;
    private readonly logger: Logger;
    private readonly waiters: ((session: TableSession) => void)[] = [];

    private static SESSION_MIN_LIMIT = 5; // TODO: Consider less sessions limit in case of serverless function
    private static SESSION_MAX_LIMIT = 20;

    constructor(settings: ITableClientSettings) {
        super();
        this.database = settings.database;
        this.authService = settings.authService;
        this.sslCredentials = settings.sslCredentials;
        this.clientOptions = settings.clientOptions;
        this.logger = settings.logger;
        const poolSettings = settings.poolSettings;
        this.minLimit = poolSettings?.minLimit || TableSessionsPool.SESSION_MIN_LIMIT;
        this.maxLimit = poolSettings?.maxLimit || TableSessionsPool.SESSION_MAX_LIMIT;
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
        await Promise.all(_.map([...this.sessions], (session: TableSession) => this.deleteSession(session)));
        this.logger.debug('Pool has been destroyed.');
    }

    private initListeners(keepAlivePeriod: number) {
        return setInterval(async () => Promise.all(
            _.map([...this.sessions], (session: TableSession) => {
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

    private async getSessionCreator(): Promise<TableSessionBuilder> {
        const endpoint = await this.discoveryService.getEndpoint();
        if (!this.sessionCreators.has(endpoint)) {
            const sessionService = new TableSessionBuilder(endpoint, this.database, this.authService, this.logger, this.sslCredentials, this.clientOptions);
            this.sessionCreators.set(endpoint, sessionService);
        }
        return this.sessionCreators.get(endpoint) as TableSessionBuilder;
    }

    private maybeUseSession(session: TableSession) {
        if (this.waiters.length > 0) {
            const waiter = this.waiters.shift();
            if (typeof waiter === "function") {
                waiter(session);
                return true;
            }
        }
        return false;
    }

    private async createSession(): Promise<TableSession> {
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

    private deleteSession(session: TableSession): Promise<void> {
        if (session.isDeleted()) {
            return Promise.resolve();
        }

        this.sessionsBeingDeleted++;
        // acquire new session as soon one of existing ones is deleted
        if (this.waiters.length > 0) {
            this.acquire().then((newSession) => {
                if (!this.maybeUseSession(newSession)) {
                    newSession.release();
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

    private acquire(timeout: number = 0): Promise<TableSession> {
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

                function waiter(session: TableSession) {
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

    private async _withSession<T>(session: TableSession, callback: SessionCallback<T>, maxRetries = 0): Promise<T> {
        try {
            const result = await callback(session);
            session.release();
            return result;
        } catch (error) {
            // TODO: Change the repetition strategy to one with different delays
            // TODO: Remove repetitions on methods (@Retry) within session
            // TODO: Add idempotency sign and do method with named parameters
            // TODO: Мark _withSession as deprecated. Consider all operationj NOT idempotent
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

    // TODO: Deprecate withSession on pool
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
    private pool: TableSessionsPool;

    constructor(settings: ITableClientSettings) {
        super();
        this.pool = new TableSessionsPool(settings);
    }

    // TODO: Deprecate withSession() in favor do(), when it will be ready
    public async withSession<T>(callback: (session: TableSession) => Promise<T>, timeout: number = 0): Promise<T> {
        return this.pool.withSession(callback, timeout);
    }

    public async withSessionRetry<T>(callback: (session: TableSession) => Promise<T>, timeout: number = 0, maxRetries = 10): Promise<T> {
        return this.pool.withSessionRetry(callback, timeout, maxRetries);
    }

    public async destroy() {
        await this.pool.destroy();
    }
}
