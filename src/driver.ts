import DiscoveryService, {Endpoint} from "./discovery";
import url from "url";
import {SessionService, TableClient, PoolSettings} from "./table";
import SchemeService from "./scheme";
import {ENDPOINT_DISCOVERY_PERIOD} from "./constants";
import {IAuthService} from "./credentials";
import {TimeoutExpired} from "./errors";
import getLogger, {Logger} from "./logging";
import SchemeClient from "./scheme";
import {Events} from './constants'
import {ClientOptions} from "./utils";
import {getCredentialsFromEnv} from "./parse-env-vars";


export interface DriverSettings {
    poolSettings?: PoolSettings;
    clientOptions?: ClientOptions;
}

function parseConnectionString(connectionString: string) {
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
    private discoveryService: DiscoveryService;
    private sessionCreators: Map<Endpoint, SessionService>;
    private logger: Logger;
    private entryPoint: string;

    public database: string;
    public tableClient: TableClient;
    public authService: IAuthService;
    public schemeClient: SchemeService;

    constructor(
        endpoint: string,
        public settings: DriverSettings = {}
    ) {
        this.logger = getLogger();

        const [entryPoint, database] = parseConnectionString(endpoint);
        this.entryPoint = entryPoint;
        this.database = database;
        this.authService = getCredentialsFromEnv(entryPoint, database, this.logger);

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
