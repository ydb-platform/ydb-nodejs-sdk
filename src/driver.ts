import {ENDPOINT_DISCOVERY_PERIOD} from './constants';
import {TimeoutExpired} from './retries/errors';
import {Logger, SimpleLogger} from './logger/simple-logger';
import {makeSslCredentials, ISslCredentials} from './utils/ssl-credentials';
import DiscoveryService from "./discovery/discovery-service";
import {TableClient} from "./table";
import {ClientOptions} from "./utils";
import {IAuthService} from "./credentials/i-auth-service";
import SchemeService from "./schema/scheme-client";
import SchemeClient from "./schema/scheme-client";
import {parseConnectionString} from "./utils/parse-connection-string";
import {QueryClient} from "./query";
import {Context} from "./context/Context";
import {HasObjectContext} from "./context/has-object-context";
import {getDefaultLogger} from "./logger/get-default-logger";
import {ensureContext} from "./context/EnsureContext";

export interface IPoolSettings {
    minLimit?: number;
    maxLimit?: number;
    keepAlivePeriod?: number;
}

export interface IDriverSettings {
    ctx?: Context,
    endpoint?: string;
    database?: string;
    connectionString?: string;
    authService: IAuthService;
    sslCredentials?: ISslCredentials,
    poolSettings?: IPoolSettings;
    clientOptions?: ClientOptions;
    logger?: Logger;
}

export default class Driver implements HasLogger, HasObjectContext {
    public readonly ctx: Context;
    public readonly logger: Logger;
    private endpoint: string;
    private database: string;
    private authService: IAuthService;
    private sslCredentials?: ISslCredentials;
    private poolSettings?: IPoolSettings;
    private clientOptions?: ClientOptions;
    private discoveryService: DiscoveryService;

    public tableClient: TableClient;
    public queryClient: QueryClient;
    public schemeClient: SchemeService;

    constructor(settings: IDriverSettings) {
        this.ctx = settings.ctx ?? Context.createNew().ctx;
        this.logger = settings.logger || getDefaultLogger();

        if (settings.connectionString) {
            const {endpoint, database} = parseConnectionString(settings.connectionString);
            this.endpoint = endpoint;
            this.database = database;
        } else if (!settings.endpoint) {
            throw new Error('The "endpoint" is a required field in driver settings');
        } else if (!settings.database) {
            throw new Error('The "database" is a required field in driver settings');
        } else {
            this.endpoint = settings.endpoint;
            this.database = settings.database;
        }

        this.sslCredentials = makeSslCredentials(this.endpoint, this.logger, settings.sslCredentials);

        this.authService = settings.authService;
        this.poolSettings = settings.poolSettings;
        this.clientOptions = settings.clientOptions;

        this.discoveryService = new DiscoveryService({
            ctx: this.ctx,
            logger: this.logger,
            endpoint: this.endpoint,
            database: this.database,
            authService: this.authService,
            sslCredentials: this.sslCredentials,
            discoveryPeriod: ENDPOINT_DISCOVERY_PERIOD
        });
        this.tableClient = new TableClient({
            // TODO: Add ctx
            database: this.database,
            authService: this.authService,
            sslCredentials: this.sslCredentials,
            poolSettings: this.poolSettings,
            clientOptions: this.clientOptions,
            discoveryService: this.discoveryService,
            logger: this.logger,
        });
        this.queryClient = new QueryClient({
            // TODO: Add ctx
            database: this.database,
            authService: this.authService,
            sslCredentials: this.sslCredentials,
            poolSettings: this.poolSettings,
            clientOptions: this.clientOptions,
            discoveryService: this.discoveryService,
            logger: this.logger,
        });
        this.schemeClient = new SchemeClient({
            // TODO: Add ctx
            database: this.database,
            authService: this.authService,
            sslCredentials: this.sslCredentials,
            clientOptions: this.clientOptions,
            discoveryService: this.discoveryService,
            logger: this.logger,
        });
    }

    public async ready(timeout: number): Promise<boolean> { // works within driver ctx
        try {
            await this.discoveryService.ready(this.ctx, timeout);
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

    // @ts-ignore
    public async destroy(): Promise<void>;
    public async destroy(ctx: Context): Promise<void>;
    @ensureContext()
    public async destroy(ctx: Context): Promise<void> {
        this.logger.debug('Destroying driver...');
        this.discoveryService.destroy();
        await Promise.all([
            this.tableClient.destroy(ctx),
            this.queryClient.destroy(ctx),
            this.schemeClient.destroy(ctx),
        ]);
        this.logger.debug('Driver has been destroyed.');
    }

    // TODO: Upgrade project to TS 5.3+ and figyre out then it's time to start use Symbol.asyncDispose
    // async [Symbol.asyncDispose]() {
    //     return this.destroy();
    // }
}
