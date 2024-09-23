import {Ydb} from "ydb-sdk-proto";
export import GrpcQueryService = Ydb.Query.V1.QueryService;
import CreateSessionRequest = Ydb.Query.CreateSessionRequest;
import {Endpoint} from "../discovery";
import {ISslCredentials} from "../utils/ssl-credentials";
import {retryable} from "../retries_obsoleted";
import EventEmitter from "events";
import DiscoveryService from "../discovery/discovery-service";
import {Events} from "../constants";
import _ from "lodash";
import {/*BadSession, SessionBusy,*/ SessionPoolEmpty} from "../errors";
import {QuerySession} from "./query-session";
import {pessimizable} from "../utils";
import {ensureCallSucceeded} from "../utils/process-ydb-operation-result";
import {AuthenticatedService, ClientOptions} from "../utils";
import {IAuthService} from "../credentials/i-auth-service";
import {
    createSymbol, sessionAcquireSymbol,
    sessionAttachSymbol,
    sessionDeleteOnReleaseSymbol,
    sessionIsFreeSymbol,
    sessionIsClosingSymbol,
    sessionReleaseSymbol,
    sessionIsDeletedSymbol
} from './symbols';
import {Logger} from "../logger/simple-logger";
import {IClientSettings} from "../client/settings";

export class QueryService extends AuthenticatedService<GrpcQueryService> {
    public endpoint: Endpoint;
    private readonly logger: Logger;

    constructor(endpoint: Endpoint, database: string, authService: IAuthService, logger: Logger, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions) {
        const host = endpoint.toString();
        super(host, database, 'Ydb.Query.V1.QueryService', GrpcQueryService, authService, sslCredentials, clientOptions);
        this.endpoint = endpoint;
        this.logger = logger;
    }

    @retryable()
    @pessimizable
    async createSession(): Promise<QuerySession> {
        const {sessionId} = ensureCallSucceeded(await this.api.createSession(CreateSessionRequest.create()));
        const session = QuerySession[createSymbol](this.api, this, this.endpoint, sessionId, this.logger/*, this.getResponseMetadata.bind(this)*/);
        await session[sessionAttachSymbol](() => {
            session[sessionDeleteOnReleaseSymbol]();
        });
        return session;
    }
}

export enum SessionEvent {
    SESSION_RELEASE = 'SESSION_RELEASE',
    SESSION_BROKEN = 'SESSION_BROKEN'
}

export type SessionCallback<T> = (session: QuerySession) => Promise<T>;

export class QuerySessionPool extends EventEmitter {
    private readonly database: string;
    private readonly authService: IAuthService;
    private readonly sslCredentials?: ISslCredentials;
    private readonly clientOptions?: ClientOptions;
    /*private readonly*/
    minLimit: number;
    private readonly maxLimit: number;
    private readonly sessions: Set<QuerySession>;
    private readonly queryServices: Map<Endpoint, QueryService>;
    private readonly discoveryService: DiscoveryService;
    private newSessionsRequested: number;
    private sessionsBeingDeleted: number;
    private readonly logger: Logger;
    private readonly waiters: ((session: QuerySession) => void)[] = [];

    private static SESSION_MIN_LIMIT = 5;
    private static SESSION_MAX_LIMIT = 20;

    constructor(settings: IClientSettings) {
        super();
        this.database = settings.database;
        this.authService = settings.authService;
        this.sslCredentials = settings.sslCredentials;
        this.clientOptions = settings.clientOptions;
        this.logger = settings.logger;
        const poolSettings = settings.poolSettings;
        this.minLimit = poolSettings?.minLimit || QuerySessionPool.SESSION_MIN_LIMIT;
        this.maxLimit = poolSettings?.maxLimit || QuerySessionPool.SESSION_MAX_LIMIT;
        this.sessions = new Set();
        this.newSessionsRequested = 0;
        this.sessionsBeingDeleted = 0;
        this.queryServices = new Map();
        this.discoveryService = settings.discoveryService;
        this.discoveryService.on(Events.ENDPOINT_REMOVED, (endpoint: Endpoint) => {
            this.queryServices.delete(endpoint);
        });
        // this.prepopulateSessions();
    }

    public async destroy(): Promise<void> {
        this.logger.debug('Destroying query pool...');
        await Promise.all(_.map([...this.sessions], (session: QuerySession) => this.deleteSession(session)));
        this.logger.debug('Query pool has been destroyed.');
    }

    // TODO: Uncomment after switch to TS 5.3
    // [Symbol.asyncDispose]() {
    //     return this.destroy();
    // }

    // TODO: Reconsider. Seems like bad idea for serverless functions and causes problems on quick dispose
    // private prepopulateSessions() {
    //     _.forEach(_.range(this.minLimit), () => this.createSession());
    // }

    private async getSessionBuilder(): Promise<QueryService> {
        const endpoint = await this.discoveryService.getEndpoint();
        if (!this.queryServices.has(endpoint)) {
            const sessionService = new QueryService(endpoint, this.database, this.authService, this.logger, this.sslCredentials, this.clientOptions);
            this.queryServices.set(endpoint, sessionService);
        }
        return this.queryServices.get(endpoint) as QueryService;
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
        const sessionCreator = await this.getSessionBuilder();
        const session = await sessionCreator.createSession();
        session.on(SessionEvent.SESSION_RELEASE, async () => {
            if (session[sessionIsClosingSymbol]()) {
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

    private deleteSession(session: QuerySession): Promise<void> {
        if (session[sessionIsDeletedSymbol]()) {
            return Promise.resolve();
        }

        this.sessionsBeingDeleted++;
        // acquire new session as soon one of existing ones is deleted
        if (this.waiters.length > 0) {
            this.acquire().then((session) => {
                if (!this.maybeUseSession(session)) {
                    session[sessionReleaseSymbol]();
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
            if (session[sessionIsFreeSymbol]()) {
                return Promise.resolve(session[sessionAcquireSymbol]());
            }
        }

        if (this.sessions.size + this.newSessionsRequested - this.sessionsBeingDeleted <= this.maxLimit) {
            this.newSessionsRequested++;
            return this.createSession()
                .then((session) => {
                    return session[sessionAcquireSymbol]();
                })
                .finally(() => {
                    this.newSessionsRequested--;
                });
        } else {
            return new Promise((resolve, reject) => {
                let timeoutId: NodeJS.Timeout;

                function waiter(session: QuerySession) {
                    clearTimeout(timeoutId);
                    resolve(session[sessionAcquireSymbol]());
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
