import EventEmitter from "events";
import {QuerySessionPool, SessionCallback} from "./query-session-pool";
import {ISslCredentials} from "../utils/ssl-credentials";
import {IPoolSettings} from "../driver";
import DiscoveryService from "../discovery/discovery-service";
import {Logger} from "../logging";

import {ClientOptions} from "../utils";
import {IAuthService} from "../credentials/i-auth-service";
// import {withRetries} from "../retries";

export interface IQueryClientSettings {
    database: string;
    authService: IAuthService;
    sslCredentials?: ISslCredentials;
    poolSettings?: IPoolSettings;
    clientOptions?: ClientOptions;
    discoveryService: DiscoveryService;
    logger: Logger;
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

    // TODO: impl do TX with txControl
    // TODO: warn when session closed with opened TX

    public async do<T>(opts: {
        // ctx: ,
        // tx?: ,
        idempotent?: boolean,
        fn: SessionCallback<T>,
        // timeout: number | undefined,
    }) {
        // TODO: Assign timeout
        // TODO: Keep max attempts?
        // TODO: idempotent
        // return withRetries(async () => { // TODO: Remove after debug
            // TODO: Bypass ctx
            return this.pool.withSession(opts.fn);
        // });
    }

}
