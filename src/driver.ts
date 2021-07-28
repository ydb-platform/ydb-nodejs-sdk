import * as url from "url";
import DiscoveryService, {Endpoint} from "./discovery";
import {SessionService, TableClient, PoolSettings} from "./table";
import SchemeService from "./scheme";
import {ENDPOINT_DISCOVERY_PERIOD} from "./constants";
import {IAuthService} from "./credentials";
import {TimeoutExpired} from "./errors";
import getLogger, {Logger} from "./logging";
import SchemeClient from "./scheme";
import {Events} from './constants'
import {ClientOptions} from "./utils";
import {getCredentialsFromEnvNew} from "./parse-env-vars";


export interface DriverSettings {
    poolSettings?: PoolSettings;
    clientOptions?: ClientOptions;
}

export interface DriverConfig {
    connectionString?: string,
    entryPoint?: string,
    database?: string,
    rootCertificates?: Buffer,
    authService?: IAuthService,
    settings?: DriverSettings,
}

function parseConnectionString(connectionString: string): [string, string] {
    let cs = connectionString;
    if (!cs.startsWith('grpc://') && !cs.startsWith('grpcs://') ){
        cs = 'grpcs://' + cs;
    }

    let parsedUrl = url.parse(cs, true);
    let databaseParam = parsedUrl.query['database'];

    let database;
    if (databaseParam === undefined) {
        throw new Error('unknown database');
    } else if (Array.isArray(databaseParam)) {
        if (databaseParam.length === 0) {
            throw new Error('unknown database');
        }
        database = databaseParam[0];
    } else {
        database = databaseParam;
    }

    let urlWithoutQuery = parsedUrl.host || 'localhost';

    return [urlWithoutQuery, database];
}

export default class Driver {
    private entryPoint: string;
    private discoveryService: DiscoveryService;
    private sessionCreators: Map<Endpoint, SessionService>;
    private logger: Logger;

    public database: string;
    public authService: IAuthService;
    public settings: DriverSettings = {};
    public tableClient: TableClient;
    public schemeClient: SchemeService;

    constructor(
        entryPoint: string,
        database: string,
        authService: IAuthService,
        settings: DriverSettings);

    constructor(config: DriverConfig);

    constructor(
        entryPointOrConfig: string | DriverConfig,
        database?: string,
        authService?: IAuthService,
        settings?: DriverSettings
    ) {
        this.logger = getLogger();
        if (typeof entryPointOrConfig === 'string') {
            if (!database) {
                throw new Error('database is required in new Driver(entryPoint, database, authService, settings = {})');
            }
            if (!authService) {
                throw new Error('authService is required new Driver(entryPoint, database, authService, settings = {})');
            }
            this.entryPoint = entryPointOrConfig;
            this.database = database;
            this.authService = authService;
            this.settings = settings || {};
        } else {
            const config = entryPointOrConfig;
            if (config.connectionString) {
                const parsedConnectionString = parseConnectionString(config.connectionString);
                this.entryPoint = parsedConnectionString[0];
                this.database = parsedConnectionString[1];
            } else if (config.entryPoint && config.database) {
                this.entryPoint = config.entryPoint;
                this.database = config.database;
            } else {
                throw new Error('One of connectionString or entryPoint and database are required in driver config');
            }
            if (config.authService) {
                this.authService = config.authService;
            } else {
                this.authService = getCredentialsFromEnvNew(this.entryPoint, this.database, this.logger, config.rootCertificates);
            }
            this.settings = config.settings || {};
        }

        this.discoveryService = new DiscoveryService(
            this.entryPoint, this.database, ENDPOINT_DISCOVERY_PERIOD, this.authService
        );
        this.discoveryService.on(Events.ENDPOINT_REMOVED, (endpoint: Endpoint) => {
            this.sessionCreators.delete(endpoint);
        });
        this.sessionCreators = new Map();
        this.tableClient = new TableClient(this);
        this.schemeClient = new SchemeClient(this);
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

    public async getEndpoint() {
        return await this.discoveryService.getEndpoint();
    }

    public async destroy(): Promise<void> {
        this.logger.debug('Destroying driver...');
        this.discoveryService.destroy();
        await this.tableClient.destroy();
        await this.schemeClient.destroy();
        this.logger.debug('Driver has been destroyed.');
    }

    public async getSessionCreator(): Promise<SessionService> {
        const endpoint = await this.getEndpoint();
        if (!this.sessionCreators.has(endpoint)) {
            const sessionService = new SessionService(endpoint, this.authService, this.settings.clientOptions);
            this.sessionCreators.set(endpoint, sessionService);
        }
        return this.sessionCreators.get(endpoint) as SessionService;
    }
}
