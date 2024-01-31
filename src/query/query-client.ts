import EventEmitter from "events";
import {RetryParameters, withRetries} from "../retries";
import {BadSession, SessionBusy} from "../errors";
import {SessionEvent} from "../table";
import {QuerySession} from "./query-session";
import {IAuthService} from "../credentials";
import {ISslCredentials} from "../ssl-credentials";
import {IPoolSettings} from "../driver";
import {ClientOptions} from "../utils";
import DiscoveryService from "../discovery";
import {Logger} from "../logging";
import {QuerySessionsPool} from "./query-sessions-pool";
import {Ydb} from "ydb-sdk-proto";
import TransactionSettings = Ydb.Query.TransactionSettings;

type SessionCallback<T> = (session: QuerySession) => Promise<T>;
export interface IQueryClientSettings {
    database: string;
    authService: IAuthService;
    sslCredentials?: ISslCredentials;
    poolSettings?: IPoolSettings;
    clientOptions?: ClientOptions;
    discoveryService: DiscoveryService;
    logger: Logger;
}

const RETRY_PARAMETERS = new RetryParameters();

export class QueryClient extends EventEmitter {
    private pool: QuerySessionsPool;

    constructor(settings: IQueryClientSettings) {
        super();
        this.pool = new QuerySessionsPool(settings);
    }

    public async do<T>(options: {
        cb: SessionCallback<T>,
        tx: TransactionSettings,
        // timeout: number | undefined,
    }): Promise<T> {
        if (!(typeof options.cb === 'function')) throw new Error(`Invalid options.cb: ${options.cb}`);
        // if (!(options.timeout === undefined || options.timeout > 0)) throw new Error(`Invalid options.timeout: ${options.timeout}`);

        const {cb, tx/*, timeout*/} = options;

        return await withRetries(async () => {
            const session = await this.pool.acquire(); // TODO: Shouldn't be a separated session acquire timeout
            try {
                if (tx) {
                    await session.beginTransaction(tx);
                }
                const res = cb(session);
                if (tx) {
                    await session.commitTransaction();
                }
                session.release();
                return res;
            } catch (error) {
                if (error instanceof BadSession || error instanceof SessionBusy) {
                    session.emit(SessionEvent.SESSION_BROKEN);
                } else {
                    if (tx) {
                        await session.rollbackTransaction();
                    }
                    session.release();
                }
                throw error;
            }
        }, RETRY_PARAMETERS);
    }

    public async destroy() {
        await this.pool.destroy();
    }
}
