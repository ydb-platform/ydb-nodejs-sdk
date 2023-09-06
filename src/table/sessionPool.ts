import EventEmitter from "events";
import DiscoveryService, {Endpoint} from '../discovery';
import {Session} from "./session";
import {IAuthService} from '../credentials';
import {ISslCredentials} from '../ssl-credentials';
import _ from "lodash";
import {ClientOptions} from "../utils";
import {Logger} from "../logging";
import {Events, SESSION_KEEPALIVE_PERIOD} from "../constants";

import {
    SessionPoolEmpty,
    BadSession,
    SessionBusy,
} from '../errors';
import {SessionEvent} from "./internal/sessionEvent";
import {ITableClientSettings} from "./internal/ITableClientSettings";
import {SessionService} from "./sessionService";

export class SessionPool extends EventEmitter {
    private readonly database: string;
    private readonly authService: IAuthService;
    private readonly sslCredentials?: ISslCredentials;
    private readonly clientOptions?: ClientOptions;
    private readonly minLimit: number;
    private readonly maxLimit: number;
    private readonly sessions: Set<Session>;
    private readonly sessionCreators: Map<Endpoint, SessionService>;
    private readonly discoveryService: DiscoveryService;
    private newSessionsRequested: number;
    private sessionsBeingDeleted: number;
    private readonly sessionKeepAliveId: NodeJS.Timeout;
    private readonly logger: Logger;
    private readonly waiters: ((session: Session) => void)[] = [];

    private static SESSION_MIN_LIMIT = 5;
    private static SESSION_MAX_LIMIT = 20;

    constructor(settings: ITableClientSettings) {
        super();
        this.database = settings.database;
        this.authService = settings.authService;
        this.sslCredentials = settings.sslCredentials;
        this.clientOptions = settings.clientOptions;
        this.logger = settings.logger;
        const poolSettings = settings.poolSettings;
        this.minLimit = poolSettings?.minLimit || SessionPool.SESSION_MIN_LIMIT;
        this.maxLimit = poolSettings?.maxLimit || SessionPool.SESSION_MAX_LIMIT;
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

    private async getSessionCreator(): Promise<SessionService> {
        const endpoint = await this.discoveryService.getEndpoint();
        if (!this.sessionCreators.has(endpoint)) {
            const sessionService = new SessionService(endpoint, this.database, this.authService, this.logger, this.sslCredentials, this.clientOptions);
            this.sessionCreators.set(endpoint, sessionService);
        }
        return this.sessionCreators.get(endpoint) as SessionService;
    }

    private maybeUseSession(session: Session) {
        if (this.waiters.length > 0) {
            const waiter = this.waiters.shift();
            if (typeof waiter === "function") {
                waiter(session);
                return true;
            }
        }
        return false;
    }

    private async createSession(): Promise<Session> {
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

    private deleteSession(session: Session): Promise<void> {
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

type SessionCallback<T> = (session: Session) => Promise<T>;
