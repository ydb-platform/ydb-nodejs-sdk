const path = require('path');
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const _ = require('lodash');
const {decodeMessage, SERVICE_PROTO_DIR, LOADER_OPTS} = require('./utils');
const {getCredentialsMetadata} = require('./credentials');

const packageDefinition = protoLoader.loadSync(
    path.join(SERVICE_PROTO_DIR, 'ydb_table_v1.proto'),
    LOADER_OPTS
);
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const {TableService} = protoDescriptor.Ydb.Table.V1;

function _getClient(endpoint) {
    const entryPoint = `${endpoint.address}:${endpoint.port}`;
    return new TableService(entryPoint, grpc.credentials.createInsecure());
}
const getClient = _.memoize(_getClient);

function createSession(endpoint) {
    return new Promise((resolve, reject) => {
        const client = getClient(endpoint);
        const metadata = getCredentialsMetadata();
        client.CreateSession({}, metadata, (err, response) => {
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

module.exports = {
    createSession
};
