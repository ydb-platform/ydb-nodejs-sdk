import {Ydb} from "../proto/bundle";
import {ServiceFactory, BaseService} from "./utils";


type EndpointsPromise = Promise<Ydb.Discovery.ListEndpointsResult>;
type ApiService = Ydb.Discovery.V1.DiscoveryService;
type IEndpointInfo = Ydb.Discovery.IEndpointInfo;
type SuccessDiscoveryHandler = (result: Ydb.Discovery.ListEndpointsResult) => void;
type FailureDiscoveryHandler = (err: Error) => void;

const noOp = () => {};

export default class DiscoveryService extends BaseService<ApiService, ServiceFactory<ApiService>> {
    private api: ApiService;

    private endpointsPromise: EndpointsPromise;
    private resolveEndpoints: SuccessDiscoveryHandler = noOp;
    private rejectEndpoints: FailureDiscoveryHandler = noOp;
    private isInitStarted: boolean = false;

    // private selfLocation: string = '';

    constructor(entryPoint: string, database?: string) {
        super('Ydb.Discovery.V1.DiscoveryService', Ydb.Discovery.V1.DiscoveryService);
        this.api = this.getClient(entryPoint);
        this.endpointsPromise = new Promise((resolve, reject) => {
            this.resolveEndpoints = resolve;
            this.rejectEndpoints = reject;
        });
        if (database) {
            this.init(database);
        }
    }

    private discoverEndpoints(database: string): EndpointsPromise {
        return this.api.listEndpoints({database})
            .then((response) => {
                if (response && response.operation && response.operation.result && response.operation.result.value) {
                    return Ydb.Discovery.ListEndpointsResult.decode(response.operation.result.value);
                }
                throw new Error('Operation returned no result');
            });
    }

    private init(database: string): void {
        this.isInitStarted = true;
        this.discoverEndpoints(database)
            .then(this.resolveEndpoints)
            .catch(this.rejectEndpoints);
    }

    private selectEndpoint(): Promise<IEndpointInfo> {
        return this.endpointsPromise
            .then((endpointsResult) => {
                // this.selfLocation = endpointsResult.selfLocation;
                return endpointsResult.endpoints[0];
            });
    }

    public async getEndpoint(database: string): Promise<IEndpointInfo> {
        if (!this.isInitStarted) {
            this.init(database);
        }
        return this.selectEndpoint();
    }
}
