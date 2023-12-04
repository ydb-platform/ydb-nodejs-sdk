import DiscoveryService from './discovery';
import { TableClient } from './table';
import { ENDPOINT_DISCOVERY_PERIOD } from './constants';
import { IAuthService } from './credentials';
import { TimeoutExpired } from './errors';
import { getLogger, Logger } from './logging';
import { ClientOptions } from './utils';
import { parseConnectionString } from './parse-connection-string';
import { makeSslCredentials, ISslCredentials } from './ssl-credentials';
import SchemeClient from './scheme';

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
    sslCredentials?: ISslCredentials,
    poolSettings?: IPoolSettings;
    clientOptions?: ClientOptions;
    logger?: Logger;
}

export default class Driver {
    private endpoint: string;
    private database: string;
    private authService: IAuthService;
    private sslCredentials?: ISslCredentials;
    private poolSettings?: IPoolSettings;
    private clientOptions?: ClientOptions;
    private logger: Logger;
    private discoveryService: DiscoveryService;

    public tableClient: TableClient;
    public schemeClient: SchemeClient;

    constructor(settings: IDriverSettings) {
        this.logger = settings.logger || getLogger();

        if (settings.connectionString) {
            const { endpoint, database } = parseConnectionString(settings.connectionString);

            this.endpoint = endpoint;
            this.database = database;
        } else if (!settings.endpoint) {
            throw new Error('The "endpoint" is a required field in driver settings');
        } else if (settings.database) {
            this.endpoint = settings.endpoint;
            this.database = settings.database;
        } else {
            throw new Error('The "database" is a required field in driver settings');
        }

        this.sslCredentials = makeSslCredentials(this.endpoint, this.logger, settings.sslCredentials);

        this.authService = settings.authService;
        this.poolSettings = settings.poolSettings;
        this.clientOptions = settings.clientOptions;

        this.discoveryService = new DiscoveryService({
            endpoint: this.endpoint,
            database: this.database,
            authService: this.authService,
            sslCredentials: this.sslCredentials,
            discoveryPeriod: ENDPOINT_DISCOVERY_PERIOD,
            logger: this.logger,
        });
        this.tableClient = new TableClient({
            database: this.database,
            authService: this.authService,
            sslCredentials: this.sslCredentials,
            poolSettings: this.poolSettings,
            clientOptions: this.clientOptions,
            discoveryService: this.discoveryService,
            logger: this.logger,
        });
        this.schemeClient = new SchemeClient({
            database: this.database,
            authService: this.authService,
            sslCredentials: this.sslCredentials,
            clientOptions: this.clientOptions,
            discoveryService: this.discoveryService,
            logger: this.logger,
        });
    }

    public async ready(timeout: number): Promise<boolean> {
        try {
            await this.discoveryService.ready(timeout);
            this.logger.debug('Driver is ready!');

            return true;
        } catch (error) {
            if (error instanceof TimeoutExpired) {
                return false;
            }
            throw error;
        }
    }

    public async destroy(): Promise<void> {
        this.logger.debug('Destroying driver...');
        this.discoveryService.destroy();
        await this.tableClient.destroy();
        await this.schemeClient.destroy();
        this.logger.debug('Driver has been destroyed.');
    }
}
