const path = require('path');
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const _ = require('lodash');
const {decodeMessage, SERVICE_PROTO_DIR, LOADER_OPTS} = require('./utils');
const {getCredentialsMetadata} = require('./credentials');

const packageDefinition = protoLoader.loadSync(
    path.join(SERVICE_PROTO_DIR, 'ydb_discovery_v1.proto'),
    LOADER_OPTS
);
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const {DiscoveryService} = protoDescriptor.Ydb.Discovery.V1;

function _getClient(entryPoint) {
    return new DiscoveryService(entryPoint, grpc.credentials.createInsecure());
}
const getClient = _.memoize(_getClient);

function discoverEndpoints(entryPoint, database) {
    return new Promise((resolve, reject) => {
        const client = getClient(entryPoint);
        const metadata = getCredentialsMetadata();
        client.ListEndpoints({database}, metadata, (err, response) => {
            if (err) {
                reject(err);
            } else {
                try {
                    const {type_url, value} = response.operation.result;
                    const result = decodeMessage(type_url, value);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            }
        });
    });
}

let _endpoints;
let _selfLocation;

function initEndpoints(entryPoint, database) {
    if (!_endpoints) {
        return discoverEndpoints(entryPoint, database)
            .then(({endpoints, selfLocation}) => {
                _endpoints = new Map(_.map(endpoints, (endpointInfo) => [
                    endpointInfo,
                    {
                        priority: 0,
                        clients: new Set([])
                    }
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
            return [...endpoints.keys()][0];
        })
}



module.exports = {
    getEndpoint
};
