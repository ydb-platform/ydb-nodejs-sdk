import {Ydb} from "ydb-sdk-proto";
export import TableService = Ydb.Table.V1.TableService;
import CreateSessionRequest = Ydb.Table.CreateSessionRequest;
export import ICreateSessionResult = Ydb.Table.ICreateSessionResult;
import CreateSessionResult = Ydb.Table.CreateSessionResult;
import {Endpoint} from "../discovery";
import {Logger} from "../logger/simple-logger";
import {ISslCredentials} from "../utils/ssl-credentials";
import {retryable} from "../retries/retryable";
import EventEmitter from "events";
import DiscoveryService from "../discovery/discovery-service";
import {Events, SESSION_KEEPALIVE_PERIOD} from "../constants";
import _ from "lodash";
import {BadSession, SessionBusy, SessionPoolEmpty, YdbError} from "../retries/errors";

import {TableSession} from "./table-session";
import {ITableClientSettings} from "./table-client";
import {pessimizable} from "../utils";
import {getOperationPayload} from "../utils/process-ydb-operation-result";
import {AuthenticatedService, ClientOptions} from "../utils";
import {IAuthService} from "../credentials/i-auth-service";
import {Context} from "../context/Context";
import {ensureContext} from "../context/EnsureContext";
import {HasLogger} from "../logger/has-logger";
import {RetryPolicySymbol} from "../retries/symbols";

export class SessionBuilder extends AuthenticatedService<TableService> implements HasLogger {
    public endpoint: Endpoint;
    public readonly logger: Logger;

    constructor(endpoint: Endpoint, database: string, authService: IAuthService, logger: Logger, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions) {
        const host = endpoint.toString();
        super(host, database, 'Ydb.Table.V1.TableService', TableService, authService, sslCredentials, clientOptions);
        this.endpoint = endpoint;
        this.logger = logger;
    }

    // @ts-ignore
    async create(): Promise<TableSession>;
    async create(_ctx: Context): Promise<TableSession>;
    @ensureContext(true)
    @retryable()
    @pessimizable
    async create(_ctx: Context): Promise<TableSession> {
        const response = await this.api.createSession(CreateSessionRequest.create());
        const payload = getOperationPayload(response);
        const {sessionId} = CreateSessionResult.decode(payload);
        return new TableSession(this.api, this.endpoint, sessionId, this.logger, this.getResponseMetadata.bind(this));
    }
}

export enum SessionEvent {
    SESSION_RELEASE = 'SESSION_RELEASE',
    SESSION_BROKEN = 'SESSION_BROKEN'
}

type SessionCallback<T> = (session: TableSession) => Promise<T>;

export class TableSessionPool extends EventEmitter {
    private readonly database: string;
    private readonly authService: IAuthService;
    private readonly sslCredentials?: ISslCredentials;
    private readonly clientOptions?: ClientOptions;
    private readonly minLimit: number;
    private readonly maxLimit: number;
    private readonly sessions: Set<TableSession>;
    private readonly sessionBuilders: Map<Endpoint, SessionBuilder>;
    private readonly discoveryService: DiscoveryService;
    private newSessionsRequested: number;
    private sessionsBeingDeleted: number;
    private readonly sessionKeepAliveId: NodeJS.Timeout;
    private readonly logger: Logger;
    private readonly waiters: ((session: TableSession) => void)[] = [];

    private static SESSION_MIN_LIMIT = 1; // TODO: Return back to 5
    private static SESSION_MAX_LIMIT = 20;

    constructor(settings: ITableClientSettings) {
        super();
        this.database = settings.database;
        this.authService = settings.authService;
        this.sslCredentials = settings.sslCredentials;
        this.clientOptions = settings.clientOptions;
        this.logger = settings.logger;
        const poolSettings = settings.poolSettings;
        this.minLimit = poolSettings?.minLimit || TableSessionPool.SESSION_MIN_LIMIT;
        this.maxLimit = poolSettings?.maxLimit || TableSessionPool.SESSION_MAX_LIMIT;
        this.sessions = new Set();
        this.newSessionsRequested = 0;
        this.sessionsBeingDeleted = 0;
        this.sessionKeepAliveId = this.initListeners(poolSettings?.keepAlivePeriod || SESSION_KEEPALIVE_PERIOD);
        this.sessionBuilders = new Map();
        this.discoveryService = settings.discoveryService;
        this.discoveryService.on(Events.ENDPOINT_REMOVED, (endpoint: Endpoint) => {
            this.sessionBuilders.delete(endpoint);
        });
        this.prepopulateSessions();
    }

    // @ts-ignore
    public async destroy(): Promise<void>;
    public async destroy(ctx: Context): Promise<void>;
    @ensureContext(true)
    public async destroy(_ctx: Context): Promise<void> {
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

    private async getSessionBuilder(): Promise<SessionBuilder> {
        const endpoint = await this.discoveryService.getEndpoint();
        if (!this.sessionBuilders.has(endpoint)) {
            const sessionService = new SessionBuilder(endpoint, this.database, this.authService, this.logger, this.sslCredentials, this.clientOptions);
            this.sessionBuilders.set(endpoint, sessionService);
        }
        return this.sessionBuilders.get(endpoint) as SessionBuilder;
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
        const sessionCreator = await this.getSessionBuilder();
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
            this.acquire().then((session) => {
                if (!this.maybeUseSession(session)) {
                    session.release();
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

    private async _withSession<T>(_ctx: Context, session: TableSession, callback: SessionCallback<T>, maxRetries = 0): Promise<T> {
        // TODO: reolace with RetryStrategy.retry
        try {
            const result = await callback(session);
            session.release();
            return result;
        } catch (error) {
            // @ts-ignore
            if ((error as YdbError).constructor[RetryPolicySymbol]?.deleteSession) {
            // if (error instanceof BadSession || error instanceof SessionBusy) { // TODO: Remove after check
                this.logger.debug('Encountered bad or busy session, re-creating the session');
                session.emit(SessionEvent.SESSION_BROKEN);
                session = await this.createSession();
                if (maxRetries > 0) {
                    this.logger.debug(`Re-running operation in new session, ${maxRetries} left.`);
                    session.acquire();
                    return this._withSession(_ctx, session, callback, maxRetries - 1);
                }
            } else {
                session.release();
            }
            throw error;
        }
    }

    /**
     * @deprecated use tableClient.do()
     */
    // @ts-ignore
    public async withSession<T>(callback: SessionCallback<T>, timeout: number): Promise<T>;
    /**
     * @deprecated use tableClient.do()
     */
    public async withSession<T>(ctx: Context, callback: SessionCallback<T>, timeout: number): Promise<T>;
    @ensureContext(true)
    public async withSession<T>(ctx: Context, callback: SessionCallback<T>, timeout: number = 0): Promise<T> {
        const session = await this.acquire(timeout);
        return this._withSession(ctx, session, callback);
    }

    /**
     * @deprecated use tableClient.do()
     */
    // @ts-ignore
    public async withSessionRetry<T>(callback: SessionCallback<T>, timeout: number = 0, maxRetries: number): Promise<T>;
    /**
     * @deprecated use tableClient.do()
     */
    public async withSessionRetry<T>(ctx: Context, callback: SessionCallback<T>, timeout: number, maxRetries: number): Promise<T>;
    @ensureContext(true)
    public async withSessionRetry<T>(ctx: Context, callback: SessionCallback<T>, timeout: number = 0, maxRetries: number = 10): Promise<T> {
        const session = await this.acquire(timeout);
        return this._withSession(ctx, session, callback, maxRetries);
    }
}
