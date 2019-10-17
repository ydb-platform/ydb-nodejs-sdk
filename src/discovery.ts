import grpc from 'grpc';
import _ from 'lodash';
import * as $protobuf from 'protobufjs';

import {getCredentialsMetadata} from './credentials';
import {Ydb} from "../proto/bundle";


const DISCOVERY_SERVICE = 'Ydb.Discovery.V1.DiscoveryService';

function _getClient(entryPoint: string): Ydb.Discovery.V1.DiscoveryService {
    const rpcImpl: $protobuf.RPCImpl = (method, requestData, callback) => {
        const path = `/${DISCOVERY_SERVICE}/${method.name}`;
        const client = new grpc.Client(entryPoint, grpc.credentials.createInsecure());
        const metadata = getCredentialsMetadata();
        client.makeUnaryRequest(path, _.identity, _.identity, requestData, metadata, null, callback);
    };
    return Ydb.Discovery.V1.DiscoveryService.create(rpcImpl);
}
const getClient = _.memoize(_getClient);


export function discoverEndpoints(entryPoint: string, database: string) {
    const client = getClient(entryPoint);
    return client.listEndpoints({database})
        .then((response) => {
            if (response && response.operation && response.operation.result && response.operation.result.value) {
                console.log(response.operation.result)
                return Ydb.Discovery.ListEndpointsResult.decode(response.operation.result.value);
            }
            throw new Error('Operation returned no result');
        });
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
