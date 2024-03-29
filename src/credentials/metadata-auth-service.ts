import {MetadataTokenService} from "@yandex-cloud/nodejs-sdk/dist/token-service/metadata-token-service";
import * as grpc from "@grpc/grpc-js";
import {addCredentialsToMetadata} from "./add-credentials-to-metadata";
import {sleep} from "../utils";
import {ITokenService, ITokenServiceCompat} from "./i-token-service";
import {IAuthService} from "./i-auth-service";

export class MetadataAuthService implements IAuthService {
    private tokenService?: ITokenService;
    private MetadataTokenServiceClass?: typeof MetadataTokenService;

    /** Do not use this, use MetadataAuthService.create */
    constructor(tokenService?: ITokenService) {
        this.tokenService = tokenService;
    }

    /**
     * Load @yandex-cloud/nodejs-sdk and create `MetadataTokenService` if tokenService is not set
     */
    private async createMetadata(): Promise<void> {
        if (!this.tokenService) {
            const {MetadataTokenService} = await import(
                '@yandex-cloud/nodejs-sdk/dist/token-service/metadata-token-service'
                );
            this.MetadataTokenServiceClass = MetadataTokenService;
            this.tokenService = new MetadataTokenService();
        }
    }

    public async getAuthMetadata(): Promise<grpc.Metadata> {
        await this.createMetadata();
        if (
            this.MetadataTokenServiceClass &&
            this.tokenService instanceof this.MetadataTokenServiceClass
        ) {
            const token = await this.tokenService.getToken();
            return addCredentialsToMetadata(token);
        } else {
            return this.getAuthMetadataCompat();
        }
    }

    // Compatibility method for working with TokenService defined in yandex-cloud@1.x
    private async getAuthMetadataCompat(): Promise<grpc.Metadata> {
        const MAX_TRIES = 5;
        const tokenService = this.tokenService as ITokenServiceCompat;
        let token = tokenService.getToken();
        if (!token && typeof tokenService.initialize === 'function') {
            await tokenService.initialize();
            token = tokenService.getToken();
        }
        let tries = 0;
        while (!token && tries < MAX_TRIES) {
            await sleep(2000);
            tries++;
            token = tokenService.getToken();
        }
        if (token) {
            return addCredentialsToMetadata(token);
        }
        throw new Error(`Failed to fetch access token via metadata service in ${MAX_TRIES} tries!`);
    }
}
