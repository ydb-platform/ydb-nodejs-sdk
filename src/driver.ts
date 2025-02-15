import {ENDPOINT_DISCOVERY_PERIOD} from './constants';
import {TimeoutExpired} from './errors';
import {ISslCredentials, makeDefaultSslCredentials} from './utils/ssl-credentials';
import DiscoveryService from './discovery/discovery-service';
import {TableClient} from './table';
import {ClientOptions} from './utils';
import {IAuthService} from './credentials/i-auth-service';
import SchemeService from './schema/scheme-client';
import SchemeClient from './schema/scheme-client';
import {QueryClient} from './query';
import {Logger} from './logger/simple-logger';
import {getDefaultLogger} from './logger/get-default-logger';
import {TopicClient} from './topic';
import {RetryStrategy} from './retries/retryStrategy';
import {RetryParameters} from './retries/retryParameters';
import {IClientSettings} from './client/settings';

export interface IPoolSettings {
    minLimit?: number;
    maxLimit?: number;
    keepAlivePeriod?: number;
}

export interface IDriverSettings {
    /**
     * @deprecated Use connectionString instead
     */
    endpoint?: string;

    /**
     * @deprecated Use connectionString instead
     */
    database?: string;
    connectionString?: string;
    authService: IAuthService;
    sslCredentials?: ISslCredentials;
    poolSettings?: IPoolSettings;
    clientOptions?: ClientOptions;
    retrier?: RetryStrategy;
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
        let secure: boolean = false,
            endpoint: string = '',
            database: string = '';

        this.logger = settings.logger || getDefaultLogger();

        if (settings.endpoint && settings.database) {
            settings.logger?.warn(
                'The "endpoint" and "database" fields are deprecated. Use "connectionString" instead',
            );

            secure = settings.endpoint.startsWith('grpcs://') || endpoint.startsWith('https://');
            endpoint = settings.endpoint.replace(/^(grpcs?|https?):\/\//, '');
            database = settings.database;
        }

        if (settings.connectionString) {
            let cs = new URL(settings.connectionString);
            endpoint = cs.host;
            database = cs.pathname || cs.searchParams.get('database') || '';

            if (!database) {
                throw new Error(
                    'The "database" field is required in the connection string. It should be specified either in the path or as a `database` query parameter.',
                );
            }

            secure = cs.protocol === 'grpcs:' || cs.protocol === 'https:';
        }

        if (!endpoint || !database) {
            throw new Error(
                'Either "endpoint" and "database" or "connectionString" must be specified',
            );
        }

        const sslCredentials = secure
            ? settings.sslCredentials ?? makeDefaultSslCredentials()
            : undefined;

        const retrier = settings.retrier || new RetryStrategy(new RetryParameters(), this.logger);

        this.discoveryService = new DiscoveryService({
            endpoint,
            database,
            discoveryPeriod: ENDPOINT_DISCOVERY_PERIOD,
            authService: settings.authService,
            sslCredentials: sslCredentials,
            clientOptions: settings.clientOptions,
            retrier,
            logger: this.logger,
        });

        this.clientSettings = {
            database,
            authService: settings.authService,
            sslCredentials,
            poolSettings: settings.poolSettings,
            clientOptions: settings.clientOptions,
            discoveryService: this.discoveryService,
            retrier,
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
