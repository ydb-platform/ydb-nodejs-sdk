const fs = require('fs');
const path = require('path');
const protobuf = require('protobufjs');
const _ = require('lodash');


function getMessageName(type) {
    const messageNameRe = /^type.googleapis.com\/(.+)$/;
    const match = messageNameRe.exec(type);
    if (match) {
        return match[1];
    } else {
        return type;
    }
}

// protobuf.load has kind of an issue with resolving imports relative to origin files - it does not
// detect common path segments which lead to path duplication. Have to use protobuf.loadSync which is
// free from that issue. Hence made the entire call synchronous.
function loadMessageTypesSync(basePath = path.resolve(__dirname, '../kikimr/public/api/protos')) {
    const paths = [];
    const filenames = fs.readdirSync(basePath);

    for (const filename of filenames) {
        if (filename.endsWith('.proto')) {
            paths.push(path.join(basePath, filename));
        }
    }

    return protobuf.loadSync(paths);
}

const _root = loadMessageTypesSync();

function getType(qualifiedTypeName) {
    return _root.lookupType(qualifiedTypeName);
}

function decodeMessage(type, payload) {
    const messageCls = _root.lookupType(getMessageName(type));
    return messageCls.decode(payload);
}

const SERVICE_PROTO_DIR = path.resolve(__dirname, '../kikimr/public/api/grpc');
const LOADER_OPTS = {
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

module.exports = {
    getType,
    decodeMessage,
    SERVICE_PROTO_DIR,
    LOADER_OPTS
};
