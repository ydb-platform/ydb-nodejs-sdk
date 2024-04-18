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
import {
    sessionTxSettingsSymbol,
    sessionTxIdSymbol,
    sessionRollbackTransactionSymbol,
    sessionCommitTransactionSymbol,
    sessionCurrentOperationSymbol,
    sessionReleaseSymbol
} from "./symbols";
import {BadSession, SessionBusy, TransportError, YdbError} from "../retries/errors";
import {Context, CtxDispose} from "../context/Context";
import {ensureContext} from "../context/EnsureContext";
import {HasLogger} from "../logger/has-logger";
import {HasObjectContext} from "../context/has-object-context";
import {RetryStrategy} from "../retries/retryStrategy";
import {RetryParameters} from "../retries/retryParameters";
import {RetryPolicySymbol} from "../retries/symbols";

export interface IQueryClientSettings {
    ctx: Context,
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
export class QueryClient extends EventEmitter implements HasLogger, HasObjectContext {
    public readonly objCtx: Context;
    public readonly logger: Logger;
    private retryer: RetryStrategy;
    private pool: QuerySessionPool;

    constructor(settings: IQueryClientSettings) {
        super();
        this.objCtx = settings.ctx;
        this.logger = settings.logger;
        this.retryer = new RetryStrategy(new RetryParameters(), this.logger);
        this.pool = new QuerySessionPool(settings);
    }

    public async destroy(ctx: Context) {
        await this.pool.destroy(ctx);
    }

    @ensureContext()
    public async do<T>(opts: IDoOpts<T>): Promise<T> {
        let ctx = opts.ctx!; // guarnteed by @ensureContext()
        let disposeTimeout: CtxDispose | undefined;
        if (opts.timeout) {
            ({ctx, dispose: disposeTimeout} = ctx.createChild({
                timeout: opts.timeout,
            }));
        }
        try {
            // TODO: Bypass idempotency state to retrier
            return this.retryer.retry(ctx, async (_ctx, _attemptsCount, _logger) => {
                const session = await this.pool.acquire();
                let result: T | undefined, err: YdbError | undefined;
                try {
                    if (opts.txSettings) session[sessionTxSettingsSymbol] = opts.txSettings;
                    try {
                        result = await opts.fn(session);
                        if (session[sessionTxIdSymbol]) { // there is an open transaction within session
                            if (opts.txSettings) {
                                // likely doTx was called and user expects have the transaction being commited
                                await session[sessionCommitTransactionSymbol]();
                            } else {
                                // likely do() was called and user intentionally haven't closed transaction
                                await session[sessionRollbackTransactionSymbol]();
                            }
                        }
                    } catch (error) {
                        if (TransportError.isMember(error)) error = TransportError.convertToYdbError(error);
                        if (error instanceof YdbError) err = error;
                        else throw error;
                    }

                } finally {
                    // TODO: Cleanup idempotentocy
                    // delete session[sessionTxId];
                    delete session[sessionTxSettingsSymbol];
                    delete session[sessionCurrentOperationSymbol];
                    // @ts-ignore
                    if (err?.constructor[RetryPolicySymbol].deleteSession) {
                        session.emit(SessionEvent.SESSION_BROKEN);
                    } else {
                        session[sessionReleaseSymbol]();
                    }
                }
                return {
                    result,
                    err,
                    idempotent: false,  // TODO: Get from session
                };
            });
        } finally {
            if (disposeTimeout) disposeTimeout();
        }
    }

    @ensureContext()
    public doTx<T>(opts: IDoOpts<T>): Promise<T> {
        if (!opts.txSettings) {
            opts = {...opts, txSettings: AUTO_TX.beginTx};
        }
        return this.do<T>(opts);
    }
}
