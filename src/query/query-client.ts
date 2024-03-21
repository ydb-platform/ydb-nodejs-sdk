import EventEmitter from "events";
import {QuerySessionPool, SessionCallback} from "./query-session-pool";
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
    // ctx?: Context
    txSettong?: Ydb.Query.ITransactionSettings,
    fn: SessionCallback<T>,
    timeout?: number,
}

export class QueryClient extends EventEmitter {
    private pool: QuerySessionPool;

    constructor(settings: IQueryClientSettings) {
        super();
        this.pool = new QuerySessionPool(settings);
    }

    public async destroy() {
        await this.pool.destroy();
    }

    public doTx<T>(opts: IDoOpts<T>): Promise<T> {
        if (!opts.txSettong) {
            opts = {...opts, txSettong: AUTO_TX.beginTx};
        }
        return this.do<T>(opts);
    }

    public async do<T>(opts: IDoOpts<T>): Promise<T> {
        // TODO: Bypass idempotency to retrier
        return withRetries<T>(async () => {
            const session = await this.pool.acquire();
            try {
                if (opts.txSettong) session[symbols.sessionTxSettings] = opts.txSettong;
                // return opts.fn(session);
                const res = await opts.fn(session);
                return res;
            } finally {
                // TODO: Cleanup idempotentocy
                delete session[symbols.sessionTxSettings];
                if (session[symbols.sessionTxId]) { // there is an open transaction within session
                    if (opts.txSettong) {
                        // likely doTx was called and user expects have the transaction being commited
                        await session.commitTransaction();
                    } else {
                        // likely do() was called and user intentionally haven't closed transaction
                        await session.rollbackTransaction();
                    }
                }
                if (session[symbols.sessionCurrentOperation]) {
                    // TODO: Debug log
                    session[symbols.sessionRelease]()
                }
            }
            session[symbols.sessionRelease]();
        })
    }
}
