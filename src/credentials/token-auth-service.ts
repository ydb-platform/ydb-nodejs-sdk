import * as grpc from "@grpc/grpc-js";
import {addCredentialsToMetadata} from "./add-credentials-to-metadata";

import {IAuthService} from "./i-auth-service";

export class TokenAuthService implements IAuthService {
    constructor(private token: string) {
    }

    public async getAuthMetadata(): Promise<grpc.Metadata> {
        return addCredentialsToMetadata(this.token);
    }
}
