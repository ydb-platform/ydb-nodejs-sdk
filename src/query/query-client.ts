import EventEmitter from "events";
import { Metadata } from "@grpc/grpc-js";
import { Ydb } from "ydb-sdk-proto";
import { AUTO_TX } from "../table";
import { QuerySessionPool, SessionCallback, SessionEvent } from "./query-session-pool";
import {
    sessionTxSettingsSymbol,
    sessionTxIdSymbol,
    sessionRollbackTransactionSymbol,
    sessionCommitTransactionSymbol,
    sessionCurrentOperationSymbol,
    sessionReleaseSymbol, isIdempotentSymbol, isIdempotentDoLevelSymbol, ctxSymbol,
    sessionTrailerCallbackSymbol
} from "./symbols";
import { YdbError } from "../errors";
import { Context } from "../context";
import { ensureContext } from "../context";
import { Logger } from "../logger/simple-logger";
import { RetryStrategy } from "../retries/retryStrategy";
import { RetryPolicySymbol } from "../retries/symbols";
import { IClientSettings } from "../client/settings";


interface IDoOpts<T> {
    ctx?: Context,
    // ctx?: Context
    txSettings?: Ydb.Query.ITransactionSettings,
    fn: SessionCallback<T>,
    timeout?: number,
    idempotent?: boolean,
    onTrailer?: (metadata: Metadata) => void
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
    private retrier: RetryStrategy;

    constructor(settings: IClientSettings) {
        super();
        this.retrier = settings.retrier;
        this.pool = new QuerySessionPool(settings);
        this.logger = settings.logger;
    }

    public async destroy() {
        await this.pool.destroy();
    }

    @ensureContext()
    public async do<T>(opts: IDoOpts<T>): Promise<T> {
        return opts.ctx!.wrap(
            {
                timeout: opts.timeout
            },
            async (ctx) => {
                return this.retrier.retry<T>(ctx, async (_ctx) => {
                    const session = await this.pool.acquire();
                    session[ctxSymbol] = ctx;
                    if (opts.hasOwnProperty('idempotent')) {
                        session[isIdempotentDoLevelSymbol] = true;
                        session[isIdempotentSymbol] = opts.idempotent;
                    }

                    if (opts.hasOwnProperty('onTrailer')) {
                        session[sessionTrailerCallbackSymbol] = opts.onTrailer;
                    }

                    let error: Error;
                    try {
                        if (opts.txSettings) session[sessionTxSettingsSymbol] = opts.txSettings;
                        let res: T;
                        try {
                            res = await opts.fn(session);
                        } catch (err) {
                            if (err instanceof YdbError) {
                                delete session[sessionTxIdSymbol];
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
                        return { result: res };
                    } catch (err) {
                        error = err as Error;
                        return { err: error, idempotent: session[isIdempotentSymbol] }
                    } finally {
                        delete session[ctxSymbol];
                        delete session[sessionTxSettingsSymbol];
                        delete session[sessionCurrentOperationSymbol];
                        delete session[isIdempotentDoLevelSymbol];
                        delete session[isIdempotentSymbol];
                        delete session[sessionTrailerCallbackSymbol];
                        // @ts-ignore
                        if (error && (error as any)[RetryPolicySymbol]?.deleteSession) {
                            this.logger.debug('Encountered bad or busy session, re-creating the session');
                            session.emit(SessionEvent.SESSION_BROKEN);
                        } else {
                            session[sessionReleaseSymbol]();
                        }
                    }
                });
            })
    }

    @ensureContext()
    public doTx<T>(opts: IDoOpts<T>): Promise<T> {
        if (!opts.txSettings) {
            opts = { ...opts, txSettings: AUTO_TX.beginTx };
        }
        return this.do<T>(opts);
    }
}
