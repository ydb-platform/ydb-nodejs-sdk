import * as grpc from '@grpc/grpc-js';
import { IAuthService } from './IAuthService';

export class AnonymousAuthService implements IAuthService {
    constructor() {}
    public async getAuthMetadata(): Promise<grpc.Metadata> {
        return new grpc.Metadata();
    }
}
