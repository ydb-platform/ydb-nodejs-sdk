const fs = require('fs');
const path = require('path');
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const _ = require('lodash');

const {loadMessageTypesSync, getMessageName} = require('./utils');

const SERVICE_PROTO_PATH = path.resolve(__dirname, '../kikimr/public/api/grpc/ydb_discovery_v1.proto');

const loaderOpts = {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    protobufjsVersion: 6,
    includeDirs: [
        path.resolve(__dirname, '..')
    ]
};

const packageDefinition = protoLoader.loadSync(SERVICE_PROTO_PATH, loaderOpts);

function readToken(pathname) {
    if (fs.existsSync(pathname)) {
        const token = fs.readFileSync(pathname);
        return String(token).trim();
    } else {
        return '';
    }
}

const OAUTH_TOKEN = readToken(path.resolve(__dirname, '../secrets/oauth.token'));
const DB_PATH_NAME = '/ru-prestable/home/tsufiev/mydb';
const DB_ENDPOINT = 'ydb-ru-prestable.yandex.net:2135';

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

const {DiscoveryService} = protoDescriptor.Ydb.Discovery.V1;

const client = new DiscoveryService(DB_ENDPOINT, grpc.credentials.createInsecure());

const metadata = new grpc.Metadata();
metadata.add('x-ydb-auth-ticket', OAUTH_TOKEN);

client.ListEndpoints({database: DB_PATH_NAME}, metadata, (err, response) => {
    if (err) {
        console.log(err);
    } else {
        const root = loadMessageTypesSync();
        const {type_url, value} = response.operation.result;

        const messageCls = root.lookupType(getMessageName(type_url));
        const result = messageCls.decode(value);
        console.log(result)
    }
});
