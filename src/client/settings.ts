import {IAuthService} from "../credentials/i-auth-service";
import {ISslCredentials} from "../utils/ssl-credentials";
import {IPoolSettings} from "../driver";
import {ClientOptions} from "../utils";
import {RetryStrategy} from "../retries/retryStrategy";
import {Logger} from "../logger/simple-logger";
import DiscoveryService from "../discovery/discovery-service";

export interface IClientSettingsBase {
    database: string;
    authService: IAuthService;
    sslCredentials?: ISslCredentials;
    poolSettings?: IPoolSettings;
    clientOptions?: ClientOptions;
    retrier: RetryStrategy;
    logger: Logger;
}

export interface IDiscoverySettings extends IClientSettingsBase {
    endpoint: string;
    discoveryPeriod: number;
}

export interface IClientSettings extends IClientSettingsBase {
    discoveryService: DiscoveryService;
}
