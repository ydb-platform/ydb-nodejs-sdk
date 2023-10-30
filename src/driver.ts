import DiscoveryService from './discovery';
import { TableClient } from './table';
import SchemeService from './scheme';
import { ENDPOINT_DISCOVERY_PERIOD } from './constants';
import { IAuthService } from './credentials';
import { TimeoutExpired } from './errors';
import { Logger, SimpleLogger } from './utils/simple-logger';
import SchemeClient from './scheme';
import { ClientOptions } from './utils';
import { parseConnectionString } from './parse-connection-string';
import { makeSslCredentials, ISslCredentials } from './ssl-credentials';
import { ContextWithLogger } from './context-with-logger';

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
    private discoveryService: DiscoveryService;

    public readonly logger: Logger;
    public readonly tableClient: TableClient;
    public readonly schemeClient: SchemeService;

    constructor(settings: IDriverSettings) {
        this.logger = settings.logger || new SimpleLogger();
        const ctx = ContextWithLogger.getSafe(this.logger, 'ydb_nodejs_sdk.driver.ctor');

        if (settings.connectionString) {
            const { endpoint, database } = ctx.doSync(() => parseConnectionString(settings.connectionString!));

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

        this.sslCredentials = ctx.doSync(() => makeSslCredentials(this.endpoint, this.logger, settings.sslCredentials));

        this.authService = settings.authService;
        this.poolSettings = settings.poolSettings;
        this.clientOptions = settings.clientOptions;

        this.discoveryService = ctx.doSync(() => new DiscoveryService({
            endpoint: this.endpoint,
            database: this.database,
            authService: this.authService,
            sslCredentials: this.sslCredentials,
            discoveryPeriod: ENDPOINT_DISCOVERY_PERIOD,
            logger: this.logger,
        }));
        this.tableClient = ctx.doSync(() => new TableClient({
            database: this.database,
            authService: this.authService,
            sslCredentials: this.sslCredentials,
            poolSettings: this.poolSettings,
            clientOptions: this.clientOptions,
            discoveryService: this.discoveryService,
            logger: this.logger,
        }));
        this.schemeClient = ctx.doSync(() => new SchemeClient({
            database: this.database,
            authService: this.authService,
            sslCredentials: this.sslCredentials,
            clientOptions: this.clientOptions,
            discoveryService: this.discoveryService,
            logger: this.logger,
        }));
    }

    public async ready(timeout: number): Promise<boolean> {
        const ctx = ContextWithLogger.getSafe(this.logger, 'ydb_nodejs_sdk.driver.ready');

        try {
            await ctx.do(() => this.discoveryService.ready(timeout));
            ctx.logger.debug('Driver is ready!');

            return true;
        } catch (error) {
            if (error instanceof TimeoutExpired) {
                return false;
            }
            throw error;
        }
    }

    public async destroy(): Promise<void> {
        const ctx = ContextWithLogger.getSafe(this.logger, 'ydb_nodejs_sdk.driver.destroy');

        ctx.logger.debug('Destroying driver...');
        ctx.do(() => this.discoveryService.destroy());
        await ctx.do(() => this.tableClient.destroy());
        await ctx.do(() => this.schemeClient.destroy());
        ctx.logger.debug('Driver has been destroyed.');
    }
}
