import DiscoveryService, {Endpoint} from "./discovery";
import {SessionService} from "./table";
import {ENDPOINT_DISCOVERY_PERIOD} from "./constants";
import {ISslCredentials} from "./utils";
import {IAuthService} from "./credentials";


export default class Driver {
    private discoveryService: DiscoveryService;
    private sessionCreators: Map<Endpoint, SessionService>;

    constructor(private entryPoint: string, private database: string,
                private authService: IAuthService, private sslCredentials?: ISslCredentials) {
        this.discoveryService = new DiscoveryService(
            this.entryPoint, this.database, ENDPOINT_DISCOVERY_PERIOD, authService, sslCredentials
        );
        this.discoveryService.on('removed', (endpoint: Endpoint) => {
            this.sessionCreators.delete(endpoint);
        });
        this.sessionCreators = new Map();
    }

    public async ready(timeout: number): Promise<boolean> {
        await this.discoveryService.ready(timeout);
        console.log('Driver is ready!');
        return true;
    }

    public destroy(): void {
        console.log('Destroying driver...');
        this.discoveryService.destroy();
        console.log('Driver has been destroyed.');
    }

    public async getSessionCreator(): Promise<SessionService> {
        const endpoint = await this.discoveryService.getEndpoint();
        if (!this.sessionCreators.has(endpoint)) {
            this.sessionCreators.set(endpoint, new SessionService(endpoint, this.authService, this.sslCredentials));
        }
        return this.sessionCreators.get(endpoint) as SessionService;
    }
}
