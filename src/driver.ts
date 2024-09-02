import {ENDPOINT_DISCOVERY_PERIOD} from './constants';
import {TimeoutExpired} from './errors';
import {ISslCredentials, makeSslCredentials} from './utils/ssl-credentials';
import DiscoveryService from "./discovery/discovery-service";
import {IClientSettings, TableClient} from "./table";
import {ClientOptions} from "./utils";
import {IAuthService} from "./credentials/i-auth-service";
import SchemeService from "./schema/scheme-client";
import SchemeClient from "./schema/scheme-client";
import {parseConnectionString} from "./utils/parse-connection-string";
import {QueryClient} from "./query";
import {Logger} from "./logger/simple-logger";
import {getDefaultLogger} from "./logger/get-default-logger";
import {TopicClient} from "./topic/topic-client";

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
    private logger: Logger;
    private discoveryService: DiscoveryService;
    private _topicClient?: TopicClient;

    private clientSettings: IClientSettings;

    // TODO: Make lazy intialized
    public readonly tableClient: TableClient;
    public readonly queryClient: QueryClient;
    public readonly schemeClient: SchemeService;

    public get topic() {
        if (!this._topicClient) this._topicClient = new TopicClient(this.clientSettings);
        return this._topicClient;
    }

    constructor(settings: IDriverSettings) {
        this.logger = settings.logger || getDefaultLogger();
        let endpoint: string, database: string;
        if (settings.connectionString) {
            ({endpoint, database} = parseConnectionString(settings.connectionString));
        } else if (!settings.endpoint) {
            throw new Error('The "endpoint" is a required field in driver settings');
        } else if (!settings.database) {
            throw new Error('The "database" is a required field in driver settings');
        } else {
            endpoint = settings.endpoint;
            database = settings.database;
        }

        const sslCredentials = makeSslCredentials(endpoint, this.logger, settings.sslCredentials);

        this.discoveryService = new DiscoveryService({
            endpoint,
            database,
            discoveryPeriod: ENDPOINT_DISCOVERY_PERIOD,
            authService: settings.authService,
            sslCredentials: sslCredentials,
            clientOptions: settings.clientOptions,
            logger: this.logger,
        });

        this.clientSettings = {
            database,
            authService: settings.authService,
            sslCredentials,
            poolSettings: settings.poolSettings,
            clientOptions: settings.clientOptions,
            discoveryService: this.discoveryService,
            logger: this.logger,
        };
        this.tableClient = new TableClient(this.clientSettings);
        this.queryClient = new QueryClient(this.clientSettings);
        this.schemeClient = new SchemeClient(this.clientSettings);
    }

    public async ready(timeout: number): Promise<boolean> {
        try {
            await this.discoveryService.ready(timeout);
            this.logger.debug('Driver is ready!');
            return true;
        } catch (e) {
            if (e instanceof TimeoutExpired) {
                return false;
            } else {
                throw e;
            }
        }
    }

    public async destroy(): Promise<void> {
        this.logger.debug('Destroying driver...');
        this.discoveryService.destroy();
        await Promise.all([
            this.tableClient.destroy(),
            this.queryClient.destroy(),
            this.schemeClient.destroy(),
            this._topicClient?.destroy(),
        ]);
        this.logger.debug('Driver has been destroyed.');
    }

    // TODO: Upgrade project to TS 5.2+
    // async [Symbol.asyncDispose]() {
    //     return this.destroy();
    // }
}
