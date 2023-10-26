import {IAuthService} from "../../credentials";
import {ISslCredentials} from "../../ssl-credentials";
import {IPoolSettings} from "../../driver";
import {ClientOptions} from "../../utils";
import DiscoveryService from "../../discovery";
import {Logger} from "../../utils/simple-logger";

// package internal
export interface ITableClientSettings {
    database: string;
    authService: IAuthService;
    sslCredentials?: ISslCredentials;
    poolSettings?: IPoolSettings;
    clientOptions?: ClientOptions;
    discoveryService: DiscoveryService;
    logger: Logger;
}
