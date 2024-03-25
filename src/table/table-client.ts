import EventEmitter from "events";
import {TableSessionPool} from "./table-session-pool";
import {ISslCredentials} from "../utils/ssl-credentials";
import {IPoolSettings} from "../driver";
import DiscoveryService from "../discovery/discovery-service";
import {Logger} from "../logging";

import {TableSession} from "./table-session";
import {ClientOptions} from "../utils";
import {IAuthService} from "../credentials/i-auth-service";

export interface ITableClientSettings {
    database: string;
    authService: IAuthService;
    sslCredentials?: ISslCredentials;
    poolSettings?: IPoolSettings;
    clientOptions?: ClientOptions;
    discoveryService: DiscoveryService;
    logger: Logger;
}

export class TableClient extends EventEmitter {
    private pool: TableSessionPool;

    constructor(settings: ITableClientSettings) {
        super();
        this.pool = new TableSessionPool(settings);
    }

    public async withSession<T>(callback: (session: TableSession) => Promise<T>, timeout: number = 0): Promise<T> {
        return this.pool.withSession(callback, timeout);
    }

    public async withSessionRetry<T>(callback: (session: TableSession) => Promise<T>, timeout: number = 0, maxRetries = 10): Promise<T> {
        return this.pool.withSessionRetry(callback, timeout, maxRetries);
    }

    public async destroy() {
        await this.pool.destroy();
    }
}
