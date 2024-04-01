import EventEmitter from "events";
import {QuerySessionPool, SessionCallback, SessionEvent} from "./query-session-pool";
import {ISslCredentials} from "../utils/ssl-credentials";
import {IPoolSettings} from "../driver";
import DiscoveryService from "../discovery/discovery-service";
import {Logger} from "../logging";
import {ClientOptions} from "../utils";
import {IAuthService} from "../credentials/i-auth-service";
import {Ydb} from "ydb-sdk-proto";
import {AUTO_TX} from "../table";
import {withRetries} from "../retries";
import * as symbols from "./symbols";
import {BadSession, SessionBusy} from "../errors";
import {Context, CtxDispose} from "../context/Context";
import {EnsureContext} from "../context/ensureContext";

export interface IQueryClientSettings {
    database: string;
    authService: IAuthService;
    sslCredentials?: ISslCredentials;
    poolSettings?: IPoolSettings;
    clientOptions?: ClientOptions;
    discoveryService: DiscoveryService;
    logger: Logger;
}

interface IDoOpts<T> {
    ctx?: Context,
    // ctx?: Context
    txSettong?: Ydb.Query.ITransactionSettings,
    fn: SessionCallback<T>,
    timeout?: number,
}

/**
 * YDB Query Service client.
 *
 * # Experimental
 *
 * Notice: This API is EXPERIMENTAL and may be changed or removed in a later release.
 */
export class QueryClient extends EventEmitter {
    private pool: QuerySessionPool;
    private logger: Logger;

    constructor(settings: IQueryClientSettings) {
        super();
        this.logger = settings.logger;
        this.pool = new QuerySessionPool(settings);
    }

    public async destroy() {
        await this.pool.destroy();
    }

    @EnsureContext()
    public async do<T>(opts: IDoOpts<T>): Promise<T> {
        let ctx = opts.ctx!; // guarnteed by @EnsureContext()
        let dispose: CtxDispose;
        if (opts.timeout) {
            ({ctx, dispose} = ctx.createChild({
                timeout: opts.timeout,
            }));
        }
        try {
            // TODO: Bypass idempotency state to retrier
            return withRetries<T>(async () => {
                const session = await this.pool.acquire();
                let error;
                try {
                    if (opts.txSettong) session[symbols.sessionTxSettings] = opts.txSettong;
                    let res: T;
                    try {
                        res = await opts.fn(session);
                    } catch (err) {
                        if (session[symbols.sessionTxId] && !(err instanceof BadSession || err instanceof SessionBusy)) {
                            await session[symbols.sessionRollbackTransaction]();
                        }
                        throw err;
                    }
                    if (session[symbols.sessionTxId]) { // there is an open transaction within session
                        if (opts.txSettong) {
                            // likely doTx was called and user expects have the transaction being commited
                            await session[symbols.sessionCommitTransaction]();
                        } else {
                            // likely do() was called and user intentionally haven't closed transaction
                            await session[symbols.sessionRollbackTransaction]();
                        }
                    }
                    return res;
                } catch (err) {
                    error = err;
                    throw err;
                } finally {
                    // TODO: Cleanup idempotentocy
                    // delete session[symbols.sessionTxId];
                    delete session[symbols.sessionTxSettings];
                    delete session[symbols.sessionCurrentOperation];
                    if (error instanceof BadSession || error instanceof SessionBusy) {
                        this.logger.debug('Encountered bad or busy session, re-creating the session');
                        session.emit(SessionEvent.SESSION_BROKEN);
                    } else {
                        session[symbols.sessionRelease]();
                    }
                }
            });
        } finally {
            if (dispose) dispose();
        }
    }

    @EnsureContext()
    public doTx<T>(opts: IDoOpts<T>): Promise<T> {
        // const ctx = opts.ctx!;
        if (!opts.txSettong) {
            opts = {...opts, txSettong: AUTO_TX.beginTx};
        }
        return this.do<T>(opts);
    }
}
