import { TableClient } from './table';
import SchemeService from './scheme';
import { IAuthService } from './credentials';
import { Logger } from './logging';
import { ClientOptions } from './utils';
import { ISslCredentials } from './ssl-credentials';
export interface IPoolSettings {
    minLimit?: number;
    maxLimit?: number;
    keepAlivePeriod?: number;
}
export interface IDriverSettings {
    endpoint?: string;
    database?: string;
    connectionString?: string;
    authService: IAuthService;
    sslCredentials?: ISslCredentials;
    poolSettings?: IPoolSettings;
    clientOptions?: ClientOptions;
    logger?: Logger;
}
export default class Driver {
    private endpoint;
    private database;
    private authService;
    private sslCredentials?;
    private poolSettings?;
    private clientOptions?;
    private logger;
    private discoveryService;
    tableClient: TableClient;
    schemeClient: SchemeService;
    constructor(settings: IDriverSettings);
    ready(timeout: number): Promise<boolean>;
    destroy(): Promise<void>;
}
