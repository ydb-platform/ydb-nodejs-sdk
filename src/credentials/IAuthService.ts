import * as grpc from '@grpc/grpc-js';

export interface IAuthService {
    getAuthMetadata: () => Promise<grpc.Metadata>,
}
