import EventEmitter from 'events';
import _ from 'lodash';
import DiscoveryService, { Endpoint } from '../discovery';
import { Session } from './session';
import { IAuthService } from '../credentials';
import { ISslCredentials } from '../ssl-credentials';
import { ClientOptions } from '../utils/service-base-classes';
import { Logger } from '../utils/simple-logger';
import { Events, SESSION_KEEPALIVE_PERIOD } from '../constants';

import {
    SessionPoolEmpty,
    BadSession,
    SessionBusy,
} from '../errors';
import { SessionEvent } from './internal/session-event';
import { ITableClientSettings } from './internal/i-table-client-settings';
import { SessionService } from './session-service';
import { ContextWithLogger } from '../context-with-logger';

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
    // @ts-ignore
    private readonly logger: Logger;
    private readonly waiters: ((session: Session) => void)[] = [];

    private static SESSION_MIN_LIMIT = 5;
    private static SESSION_MAX_LIMIT = 20;

    constructor(settings: ITableClientSettings) {
        const ctx = ContextWithLogger.getSafe(settings.logger, 'ydb_nodejs_sdk.sessionPool.ctor');

        super();

        this.logger = settings.logger;
        this.database = settings.database;
        this.authService = settings.authService;
        this.sslCredentials = settings.sslCredentials;
        this.clientOptions = settings.clientOptions;
        const { poolSettings } = settings;

        this.minLimit = poolSettings?.minLimit || SessionPool.SESSION_MIN_LIMIT;
        this.maxLimit = poolSettings?.maxLimit || SessionPool.SESSION_MAX_LIMIT;
        this.sessions = new Set();
        this.newSessionsRequested = 0;
        this.sessionsBeingDeleted = 0;
        this.sessionKeepAliveId = ctx.doSync(() => this.initListeners(poolSettings?.keepAlivePeriod || SESSION_KEEPALIVE_PERIOD));
        this.sessionCreators = new Map();
        this.discoveryService = settings.discoveryService;
        this.discoveryService.on(Events.ENDPOINT_REMOVED, (endpoint: Endpoint) => {
            ctx.doHandleError(() => this.sessionCreators.delete(endpoint));
        });
        ctx.doSync(() => this.prepopulateSessions());
    }

    public async destroy(): Promise<void> {
        const ctx = ContextWithLogger.getSafe(this.logger, 'ydb_nodejs_sdk.sessionPool.destroy');

        ctx.logger.debug('Destroying pool...');
        clearInterval(this.sessionKeepAliveId);
        await Promise.all(_.map([...this.sessions], (session: Session) => ctx.do(() => this.deleteSession(session))));
        ctx.logger.debug('Pool has been destroyed.');
    }

    private initListeners(keepAlivePeriod: number) {
        const ctx = ContextWithLogger.get('ydb_nodejs_sdk.sessionPool.initListeners');

        return setInterval(async () => ctx.doHandleError(() => Promise.all(
            _.map([...this.sessions], (session: Session) => session.keepAlive()
            // delete session if error
                .catch(() => ctx.do(() => this.deleteSession(session)))
            // ignore errors to avoid UnhandledPromiseRejectionWarning
                .catch(() => {})),
        )), keepAlivePeriod);
    }

    private prepopulateSessions() {
        const ctx = ContextWithLogger.get('ydb_nodejs_sdk.sessionPool.prepopulateSessions');

        _.forEach(_.range(this.minLimit), () => ctx.do(() => this.createSession()));
    }

    private async getSessionCreator(): Promise<SessionService> {
        const ctx = ContextWithLogger.get('ydb_nodejs_sdk.sessionPool.getSessionCreator');

        const endpoint = await ctx.do(() => this.discoveryService.getEndpoint());

        if (!this.sessionCreators.has(endpoint)) {
            const sessionService = await ctx.do(() => new SessionService(endpoint, this.database, this.authService, ctx.logger, this.sslCredentials, this.clientOptions));

            this.sessionCreators.set(endpoint, sessionService);
        }

        return this.sessionCreators.get(endpoint) as SessionService;
    }

    private maybeUseSession(session: Session) {
        const ctx = ContextWithLogger.get('ydb_nodejs_sdk.sessionPool.maybeUseSession');

        if (this.waiters.length > 0) {
            const waiter = this.waiters.shift();

            if (typeof waiter === 'function') {
                ctx.do(() => waiter(session));

                return true;
            }
        }

        return false;
    }

    private async createSession(): Promise<Session> {
        const ctx = ContextWithLogger.get('ydb_nodejs_sdk.sessionPool.createSession');

        const sessionCreator = await this.getSessionCreator();
        const session = await ctx.do(() => sessionCreator.create());

        session.on(SessionEvent.SESSION_RELEASE, async () => {
            if (session.isClosing()) {
                await ctx.do(() => this.deleteSession(session));
            } else {
                ctx.do(() => this.maybeUseSession(session));
            }
        });
        session.on(SessionEvent.SESSION_BROKEN, async () => {
            await this.deleteSession(session);
        });
        ctx.do(() => this.sessions.add(session));

        return session;
    }

    private deleteSession(session: Session): Promise<void> {
        const ctx = ContextWithLogger.get('ydb_nodejs_sdk.sessionPool.deleteSession');

        if (session.isDeleted()) {
            return Promise.resolve();
        }

        this.sessionsBeingDeleted++;
        // acquire new session as soon one of existing ones is deleted
        if (this.waiters.length > 0) {
            this.acquire().then((session) => {
                if (!ctx.do(() => this.maybeUseSession(session))) {
                    ctx.do(() => session.release());
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

    private acquire(timeout = 0): Promise<Session> {
        const ctx = ContextWithLogger.get('ydb_nodejs_sdk.sessionPool.acquire');

        for (const session of this.sessions) {
            if (session.isFree()) {
                return Promise.resolve(session.acquire());
            }
        }

        if (this.sessions.size + this.newSessionsRequested - this.sessionsBeingDeleted <= this.maxLimit) {
            this.newSessionsRequested++;

            return ctx.doSync(() => this.createSession()
                .then((session) => session.acquire())
                .finally(() => {
                    this.newSessionsRequested--;
                }));
        }

        return new Promise((resolve, reject) => {
            let timeoutId: NodeJS.Timeout;

            const waiter = (session: Session) => {
                clearTimeout(timeoutId);
                resolve(session.acquire());
            };

            if (timeout) {
                timeoutId = setTimeout(() => ctx.doHandleError(() => {
                    this.waiters.splice(this.waiters.indexOf(waiter), 1);
                    reject(
                        new SessionPoolEmpty(`No session became available within timeout of ${timeout} ms`),
                    );
                }), timeout);
            }
            this.waiters.push(waiter);
        });
    }

    private async _withSession<T>(session: Session, callback: SessionCallback<T>, maxRetries = 0): Promise<T> {
        const ctx = ContextWithLogger.get('ydb_nodejs_sdk.sessionPool._withSession');

        try {
            const result = await ctx.do(() => callback(session));

            await ctx.do(() => session.release());

            return result;
        } catch (error) {
            if (error instanceof BadSession || error instanceof SessionBusy) {
                ctx.logger.debug('Encountered bad or busy session, re-creating the session');
                session.emit(SessionEvent.SESSION_BROKEN);
                session = await ctx.do(() => this.createSession());
                if (maxRetries > 0) {
                    ctx.logger.debug(`Re-running operation in new session, ${maxRetries} left.`);
                    ctx.do(() => session.acquire());

                    return this._withSession(session, callback, maxRetries - 1);
                }
            } else {
                await ctx.do(() => session.release());
            }
            throw error;
        }
    }

    public async withSession<T>(callback: SessionCallback<T>, timeout = 0): Promise<T> {
        const ctx = ContextWithLogger.getSafe(this.logger, 'ydb_nodejs_sdk.sessionPool.withSession');
        const session = await ctx.do(() => this.acquire(timeout));

        return ctx.do(() => this._withSession(session, callback));
    }

    public async withSessionRetry<T>(callback: SessionCallback<T>, timeout = 0, maxRetries = 10): Promise<T> {
        const ctx = ContextWithLogger.getSafe(this.logger, 'ydb_nodejs_sdk.sessionPool.withSessionRetry');
        const session = await ctx.do(() => this.acquire(timeout));

        return ctx.do(() => this._withSession(session, callback, maxRetries));
    }
}

type SessionCallback<T> = (session: Session) => Promise<T>;
