const path = require('path');
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const _ = require('lodash');
const {loadMessageTypesSync, getMessageName, SERVICE_PROTO_DIR, LOADER_OPTS} = require('./utils');
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
                    const root = loadMessageTypesSync();
                    const {type_url, value} = response.operation.result;

                    const messageCls = root.lookupType(getMessageName(type_url));
                    const result = messageCls.decode(value);
                    resolve(result.endpoints);
                } catch (err) {
                    reject(err);
                }
            }
        });

    });
}

module.exports = {
    discoverEndpoints
};
