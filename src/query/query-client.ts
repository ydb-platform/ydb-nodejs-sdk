import EventEmitter from "events";
import {QuerySessionPool, SessionCallback, SessionEvent} from "./query-session-pool";
import {ISslCredentials} from "../utils/ssl-credentials";
import {IPoolSettings} from "../driver";
import DiscoveryService from "../discovery/discovery-service";
import {Logger} from "../logger/simple-logger";
import {ClientOptions} from "../utils";
import {IAuthService} from "../credentials/i-auth-service";
import {Ydb} from "ydb-sdk-proto";
import {AUTO_TX} from "../table";
import {withRetries} from "../retries";
import {
    sessionTxSettingsSymbol,
    sessionTxIdSymbol,
    sessionRollbackTransactionSymbol,
    sessionCommitTransactionSymbol,
    sessionCurrentOperationSymbol,
    sessionReleaseSymbol
} from "./symbols";
import {BadSession, SessionBusy} from "../errors";
import {Context, CtxDispose} from "../context/Context";
import {EnsureContext} from "../context/EnsureContext";

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
    txSettings?: Ydb.Query.ITransactionSettings,
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
        let dispose: CtxDispose | undefined;
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
                    if (opts.txSettings) session[sessionTxSettingsSymbol] = opts.txSettings;
                    let res: T;
                    try {
                        res = await opts.fn(session);
                    } catch (err) {
                        if (session[sessionTxIdSymbol] && !(err instanceof BadSession || err instanceof SessionBusy)) {
                            await session[sessionRollbackTransactionSymbol]();
                        }
                        throw err;
                    }
                    if (session[sessionTxIdSymbol]) { // there is an open transaction within session
                        if (opts.txSettings) {
                            // likely doTx was called and user expects have the transaction being commited
                            await session[sessionCommitTransactionSymbol]();
                        } else {
                            // likely do() was called and user intentionally haven't closed transaction
                            await session[sessionRollbackTransactionSymbol]();
                        }
                    }
                    return res;
                } catch (err) {
                    error = err;
                    throw err;
                } finally {
                    // TODO: Cleanup idempotentocy
                    // delete session[sessionTxId];
                    delete session[sessionTxSettingsSymbol];
                    delete session[sessionCurrentOperationSymbol];
                    if (error instanceof BadSession || error instanceof SessionBusy) {
                        this.logger.debug('Encountered bad or busy session, re-creating the session');
                        session.emit(SessionEvent.SESSION_BROKEN);
                    } else {
                        session[sessionReleaseSymbol]();
                    }
                }
            });
        } finally {
            if (dispose) dispose();
        }
    }

    @EnsureContext()
    public doTx<T>(opts: IDoOpts<T>): Promise<T> {
        if (!opts.txSettings) {
            opts = {...opts, txSettings: AUTO_TX.beginTx};
        }
        return this.do<T>(opts);
    }
}
