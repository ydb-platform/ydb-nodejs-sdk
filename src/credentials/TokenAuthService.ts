import * as grpc from "@grpc/grpc-js";
import {IAuthService} from "./IAuthService";
import {makeCredentialsMetadata} from "./makeCredentialsMetadata";

export class TokenAuthService implements IAuthService {
    constructor(private token: string) {}

    public async getAuthMetadata(): Promise<grpc.Metadata> {
        return makeCredentialsMetadata(this.token);
    }
}
