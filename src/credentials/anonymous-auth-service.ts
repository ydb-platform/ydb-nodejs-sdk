import * as grpc from '@grpc/grpc-js';
import { IAuthService } from './i-auth-service';

export class AnonymousAuthService implements IAuthService {
    constructor() {}
    public async getAuthMetadata(): Promise<grpc.Metadata> {
        return new grpc.Metadata();
    }
}
