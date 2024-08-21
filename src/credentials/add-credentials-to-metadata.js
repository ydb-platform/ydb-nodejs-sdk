"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addCredentialsToMetadata = void 0;
var grpc = require("@grpc/grpc-js");
function addCredentialsToMetadata(token) {
    var metadata = new grpc.Metadata();
    metadata.add('x-ydb-auth-ticket', token);
    return metadata;
}
exports.addCredentialsToMetadata = addCredentialsToMetadata;
