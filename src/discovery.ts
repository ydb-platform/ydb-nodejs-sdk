import {Ydb} from "../proto/bundle";
import {ServiceFactory, BaseService} from "./utils";


export default class DiscoveryService extends BaseService<Ydb.Discovery.V1.DiscoveryService, ServiceFactory<Ydb.Discovery.V1.DiscoveryService>> {
    private api: Ydb.Discovery.V1.DiscoveryService;

    constructor(entryPoint: string) {
        super('Ydb.Discovery.V1.DiscoveryService', Ydb.Discovery.V1.DiscoveryService);
        this.api = this.getClient(entryPoint);
    }

    public discoverEndpoints(database: string): Promise<Ydb.Discovery.ListEndpointsResult> {
        return this.api.listEndpoints({database})
            .then((response) => {
                if (response && response.operation && response.operation.result && response.operation.result.value) {
                    return Ydb.Discovery.ListEndpointsResult.decode(response.operation.result.value);
                }
                throw new Error('Operation returned no result');
            });
    }
}

/*
let _endpoints;
let _selfLocation;

class Endpoint {
    constructor(endpointInfo, database) {
        this.info = endpointInfo;
        this.database = database;
        this.priority = 0;
        this.clients = new Set([]);
    }
}

function initEndpoints(entryPoint: string, database: string) {
    if (!_endpoints) {
        return discoverEndpoints(entryPoint, database)
            .then(({endpoints, selfLocation}) => {
                _endpoints = new Map(_.map(endpoints, (endpointInfo) => [
                    endpointInfo,
                    new Endpoint(endpointInfo, database)
                ]));
                _selfLocation = selfLocation;
                return _endpoints;
            })
    } else {
        return Promise.resolve(_endpoints);
    }
}

function getEndpoint(entryPoint, database) {
    return initEndpoints(entryPoint, database)
        .then((endpoints) => {
            // logic for selection the optimal endpoint to be implemented later,
            // for now return the first one
            return [...endpoints.values()][0];
        })
}


module.exports = {
    getEndpoint
};
*/
