import {Ydb} from 'ydb-sdk-proto';
import {IAuthService} from "../credentials";
import {ISslCredentials} from "../ssl-credentials";
import {AuthenticatedService, ClientOptions, pessimizable} from "../utils";
import DiscoveryService, {Endpoint} from "../discovery";
import {Logger} from "../logging";
import EventEmitter from "events";
import {Events} from "../constants";
import _ from "lodash";
import {SessionPoolEmpty} from "../errors";
import {retryable} from "../retries";
import {QuerySession} from "./query-session";
import {SessionEvent} from "../table/session-event";
import {ensureOperationSucceeded} from "./query-utils";
import {IQueryClientSettings} from "./query-client";
import QueryService = Ydb.Query.V1.QueryService;
import CreateSessionRequest = Ydb.Query.CreateSessionRequest;

export class QuerySessionCreator extends AuthenticatedService<QueryService> {
    public endpoint: Endpoint;
    private readonly logger: Logger;

    constructor(endpoint: Endpoint, database: string, authService: IAuthService, logger: Logger, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions) {
        const host = endpoint.toString();
        super(host, database, 'Ydb.Query.V1.QueryService', QueryService, authService, sslCredentials, clientOptions, [
            'AttachSession', 'ExecuteQuery' // methods that return Stream
        ]);
        this.endpoint = endpoint;
        this.logger = logger;
    }

    @retryable()
    @pessimizable
    async create(): Promise<QuerySession> {
        const response = ensureOperationSucceeded(await this.api.createSession(CreateSessionRequest.create()));
        const {sessionId} = response;
        const session = new QuerySession(this.api, this.endpoint, sessionId, this.logger/*, this.getResponseMetadata.bind(this)*/);
        await session.attach();
        return session;
    }
}

export class QuerySessionsPool extends EventEmitter {
    private readonly database: string;
    private readonly authService: IAuthService;
    private readonly sslCredentials?: ISslCredentials;
    private readonly clientOptions?: ClientOptions;
    private readonly minLimit: number;
    private readonly maxLimit: number;
    private readonly sessions: Set<QuerySession>;
    private readonly sessionCreators: Map<Endpoint, QuerySessionCreator>;
    private readonly discoveryService: DiscoveryService;
    private newSessionsRequested: number;
    private sessionsBeingDeleted: number;
    private readonly logger: Logger;
    private readonly waiters: ((session: QuerySession) => void)[] = [];

    private static SESSION_MIN_LIMIT = 5; // TODO: Consider less sessions limit in case of serverless function
    private static SESSION_MAX_LIMIT = 20;

    constructor(settings: IQueryClientSettings) {
        super();
        this.database = settings.database;
        this.authService = settings.authService;
        this.sslCredentials = settings.sslCredentials;
        this.clientOptions = settings.clientOptions;
        this.logger = settings.logger;
        const poolSettings = settings.poolSettings;
        this.minLimit = poolSettings?.minLimit || QuerySessionsPool.SESSION_MIN_LIMIT;
        this.maxLimit = poolSettings?.maxLimit || QuerySessionsPool.SESSION_MAX_LIMIT;
        this.sessions = new Set();
        this.newSessionsRequested = 0;
        this.sessionsBeingDeleted = 0;
        this.sessionCreators = new Map();
        this.discoveryService = settings.discoveryService;
        this.discoveryService.on(Events.ENDPOINT_REMOVED, (endpoint: Endpoint) => {
            this.sessionCreators.delete(endpoint);
        });
        this.prepopulateSessions();
    }

    public async destroy(): Promise<void> {
        this.logger.debug('Destroying pool...');
        await Promise.all(_.map([...this.sessions], (session: QuerySession) => this.deleteSession(session)));
        this.logger.debug('Pool has been destroyed.');
    }

    private prepopulateSessions() {
        _.forEach(_.range(this.minLimit), () => this.createSession());
    }

    private async getSessionCreator(): Promise<QuerySessionCreator> {
        const endpoint = await this.discoveryService.getEndpoint();
        if (!this.sessionCreators.has(endpoint)) {
            const sessionService = new QuerySessionCreator(endpoint, this.database, this.authService, this.logger, this.sslCredentials, this.clientOptions);
            this.sessionCreators.set(endpoint, sessionService);
        }
        return this.sessionCreators.get(endpoint) as QuerySessionCreator;
    }

    private maybeUseSession(session: QuerySession) {
        if (this.waiters.length > 0) {
            const waiter = this.waiters.shift();
            if (typeof waiter === "function") {
                waiter(session);
                return true;
            }
        }
        return false;
    }

    private async createSession(): Promise<QuerySession> {
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
        // TODO: Make long running connection !
        this.sessions.add(session);
        return session;
    }

    private deleteSession(session: QuerySession): Promise<void> {
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

    public acquire(timeout: number = 0): Promise<QuerySession> {
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

                function waiter(session: QuerySession) {
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
}

