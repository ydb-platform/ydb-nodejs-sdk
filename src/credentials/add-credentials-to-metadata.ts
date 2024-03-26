import * as grpc from "@grpc/grpc-js";

export function addCredentialsToMetadata(token: string): grpc.Metadata {
    const metadata = new grpc.Metadata();
    metadata.add('x-ydb-auth-ticket', token);
    return metadata;
}
