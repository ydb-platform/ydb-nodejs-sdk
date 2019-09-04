const fs = require('fs');
const path = require('path');
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');

const SERVICE_PROTO_PATH = path.resolve(__dirname, './kikimr/public/api/grpc/ydb_discovery_v1.proto');

const packageDefinition = protoLoader.loadSync(
    SERVICE_PROTO_PATH,
    {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [
            __dirname
        ]
    }
);

function readToken(pathname) {
    if (fs.existsSync(pathname)) {
        const token = fs.readFileSync(pathname);
        return String(token).trim();
    } else {
        return '';
    }
}

const OAUTH_TOKEN = readToken(path.resolve(__dirname, 'secrets/oauth.token'));

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

const {DiscoveryService} = protoDescriptor.Ydb.Discovery.V1;

const client = new DiscoveryService('ydb-ru-prestable.yandex.net:2135', grpc.credentials.createInsecure());

const metadata = new grpc.Metadata();
metadata.add('x-ydb-auth-ticket', OAUTH_TOKEN);

client.ListEndpoints({database: '/ru-prestable/home/tsufiev/mydb'}, metadata, (err, response) => {
    if (err) {
        console.log(err);
    } else {
        console.log('Response', response)
    }
});
