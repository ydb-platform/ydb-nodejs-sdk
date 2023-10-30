import * as grpc from '@grpc/grpc-js';
import { IAuthService } from './i-auth-service';
import { makeCredentialsMetadata } from './make-credentials-metadata';

export class TokenAuthService implements IAuthService {
    constructor(private token: string) {}

    public async getAuthMetadata(): Promise<grpc.Metadata> {
        return makeCredentialsMetadata(this.token);
    }
}
