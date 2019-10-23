import _ from 'lodash';
import {Ydb} from "../proto/bundle";
import {ServiceFactory, BaseService, getOperationPayload} from "./utils";
import DiscoveryServiceAPI = Ydb.Discovery.V1.DiscoveryService;
import IEndpointInfo = Ydb.Discovery.IEndpointInfo;


type SuccessDiscoveryHandler = (result: Endpoint[]) => void;
type FailureDiscoveryHandler = (err: Error) => void;

const noOp = () => {};

export class Endpoint extends Ydb.Discovery.EndpointInfo {
    static HOST_RE = /^([^:]+):?(\d)*$/;

    static fromString(host: string) {
        const match = Endpoint.HOST_RE.exec(host);
        if (match) {
            const info: Ydb.Discovery.IEndpointInfo = {
                address: match[1]
            };
            if (match[2]) {
                info.port = Number(match[2]);
            }
            return this.create(info);
        }
        throw new Error(`Provided incorrect host "${host}"`);
    }

    public database: string = '';

    constructor(properties: IEndpointInfo, database: string) {
        super(properties);
        this.setDatabase(database);
    }

    public toString(): string {
        let result = this.address;
        if (this.port) {
            result += ':' + this.port;
        }
        return result;
    }

    private setDatabase(database: string) {
        this.database = database;
    }
}

export default class DiscoveryService extends BaseService<DiscoveryServiceAPI, ServiceFactory<DiscoveryServiceAPI>> {
    private endpointsPromise: Promise<Endpoint[]>;
    private resolveEndpoints: SuccessDiscoveryHandler = noOp;
    private rejectEndpoints: FailureDiscoveryHandler = noOp;
    private isInitStarted: boolean = false;

    // private selfLocation: string = '';

    constructor(entryPoint: string, database?: string) {
        super(entryPoint, 'Ydb.Discovery.V1.DiscoveryService', DiscoveryServiceAPI);
        this.endpointsPromise = new Promise((resolve, reject) => {
            this.resolveEndpoints = resolve;
            this.rejectEndpoints = reject;
        });
        if (database) {
            this.init(database);
        }
    }

    private discoverEndpoints(database: string): Promise<Endpoint[]> {
        return this.api.listEndpoints({database})
            .then((response) => {
                const payload = getOperationPayload(response);
                const endpointsResult = Ydb.Discovery.ListEndpointsResult.decode(payload);
                // this.selfLocation = endpointsResult.selfLocation;
                return _.map(endpointsResult.endpoints, (endpointInfo) => new Endpoint(endpointInfo, database))
            });
    }

    private init(database: string): void {
        this.isInitStarted = true;
        this.discoverEndpoints(database)
            .then(this.resolveEndpoints)
            .catch(this.rejectEndpoints);
    }

    private selectEndpoint(): Promise<Endpoint> {
        return this.endpointsPromise
            .then((endpoints) => {
                return endpoints[0];
            });
    }

    public async getEndpoint(database: string): Promise<Endpoint> {
        if (!this.isInitStarted) {
            this.init(database);
        }
        return this.selectEndpoint();
    }
}
