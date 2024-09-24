import * as grpc from "@grpc/grpc-js";

export function addCredentialsToMetadata(token: string): grpc.Metadata {
    const metadata = new grpc.Metadata();
    metadata.add('x-ydb-auth-ticket', token);
    return metadata;
}

export function getTokenFromMetadata(metadata: grpc.Metadata): string | undefined {
    const array = metadata.get('x-ydb-auth-ticket');
    return array ? array[0] as string : undefined;
}
