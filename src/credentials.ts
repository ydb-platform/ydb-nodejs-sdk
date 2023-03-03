import * as grpc from '@grpc/grpc-js';
import jwt from 'jsonwebtoken';
import {DateTime} from 'luxon';
import {getOperationPayload, GrpcService, sleep, withTimeout} from './utils';
import {yandex, Ydb} from 'ydb-sdk-proto';
import {ISslCredentials, makeDefaultSslCredentials} from './ssl-credentials';
import IamTokenService = yandex.cloud.iam.v1.IamTokenService;
import AuthServiceResult = Ydb.Auth.LoginResult;
import ICreateIamTokenResponse = yandex.cloud.iam.v1.ICreateIamTokenResponse;
import type {MetadataTokenService} from '@yandex-cloud/nodejs-sdk/dist/token-service/metadata-token-service';

function makeCredentialsMetadata(token: string): grpc.Metadata {
    const metadata = new grpc.Metadata();
    metadata.add('x-ydb-auth-ticket', token);
    return metadata;
}

export interface IIamCredentials {
    serviceAccountId: string,
    accessKeyId: string,
    privateKey: Buffer,
    iamEndpoint: string
}

interface ITokenServiceYC {
    getToken: () => Promise<string>;
}
interface ITokenServiceCompat {
    getToken: () => string | undefined;
    initialize?: () => Promise<void>;
}
export type ITokenService = ITokenServiceYC | ITokenServiceCompat;

export interface IAuthService {
    getAuthMetadata: () => Promise<grpc.Metadata>,
}

export class AnonymousAuthService implements IAuthService {
    constructor() {}
    public async getAuthMetadata(): Promise<grpc.Metadata> {
        return new grpc.Metadata();
    }
}

interface StaticCredentialsAuthOptions {
    /** Custom ssl sertificates. If you use it in driver, you must use it here too */
    sslCredentials?: ISslCredentials;
    /** 
     * Timeout for token request in milliseconds
     * @default 10 * 1000
     */
    tokenRequestTimeout?: number;
    /** Expiration time for token in milliseconds
     * @default 6 * 60 * 60 * 1000
     */
    tokenExpirationTimeout?: number
}

export class StaticCredentialsAuthService implements IAuthService {
    private readonly tokenRequestTimeout = 10 * 1000;
    private readonly tokenExpirationTimeout = 6 * 60 * 60 * 1000;
    private tokenTimestamp: DateTime | null;
    private token: string = "";
    private tokenUpdatePromise: Promise<any> | null = null;
    private user: string;
    private password: string;
    private endpoint: string;
    private sslCredentials: ISslCredentials | undefined;

    private readonly GrpcService = class extends GrpcService<Ydb.Auth.V1.AuthService> {
        constructor(endpoint: string, sslCredentials?: ISslCredentials) {
            super(endpoint, "Ydb.Auth.V1.AuthService", Ydb.Auth.V1.AuthService, sslCredentials);
        }

        login(request: Ydb.Auth.ILoginRequest) {
            return this.api.login(request);
        }

        destroy() {
            this.api.end();
        }
    };

    constructor(
        user: string,
        password: string,
        endpoint: string,
        options?: StaticCredentialsAuthOptions
    ) {
        this.tokenTimestamp = null;
        this.user = user;
        this.password = password;
        this.endpoint = endpoint;
        this.sslCredentials = options?.sslCredentials;
        if (options?.tokenRequestTimeout) this.tokenRequestTimeout = options.tokenRequestTimeout;
        if (options?.tokenExpirationTimeout) this.tokenExpirationTimeout = options.tokenExpirationTimeout;
    }

    private get expired() {
        return !this.tokenTimestamp || (
            DateTime.utc().diff(this.tokenTimestamp).valueOf() > this.tokenExpirationTimeout
        );
    }

    private async sendTokenRequest(): Promise<AuthServiceResult> {
        let runtimeAuthService = new this.GrpcService(this.endpoint, this.sslCredentials);
        try {
            const tokenPromise = runtimeAuthService.login({
                user: this.user,
                password: this.password,
            });
            const response = await withTimeout<Ydb.Auth.LoginResponse>(tokenPromise, this.tokenRequestTimeout);
            const result = AuthServiceResult.decode(getOperationPayload(response));
            runtimeAuthService.destroy();
            return result;
        } catch (error) {
            throw new Error("Can't login by user and password " + String(error));
        }
    }

    private async updateToken() {
        const { token } = await this.sendTokenRequest();
        if (token) {
            this.token = token;
            this.tokenTimestamp = DateTime.utc();
        } else {
            throw new Error("Received empty token from credentials!");
        }
    }

    public async getAuthMetadata(): Promise<grpc.Metadata> {
        if (this.expired || this.tokenUpdatePromise) {
            if (!this.tokenUpdatePromise) {
                this.tokenUpdatePromise = this.updateToken();
            }
            await this.tokenUpdatePromise;
            this.tokenUpdatePromise = null;
        }
        return makeCredentialsMetadata(this.token);
    }
}

export class TokenAuthService implements IAuthService {
    constructor(private token: string) {}

    public async getAuthMetadata(): Promise<grpc.Metadata> {
        return makeCredentialsMetadata(this.token);
    }
}

export class IamAuthService implements IAuthService {
    private jwtExpirationTimeout = 3600 * 1000;
    private tokenExpirationTimeout = 120 * 1000;
    private tokenRequestTimeout = 10 * 1000;
    private token: string = '';
    private tokenTimestamp: DateTime|null;
    private tokenUpdateInProgress: Boolean = false;
    private readonly iamCredentials: IIamCredentials;
    private readonly sslCredentials: ISslCredentials;
    private readonly GrpcService = class extends GrpcService<IamTokenService> {
        constructor(iamCredentials: IIamCredentials, sslCredentials: ISslCredentials) {
            super(
                iamCredentials.iamEndpoint,
                'yandex.cloud.iam.v1.IamTokenService',
                IamTokenService,
                sslCredentials,
            );
        }
    
        create(request: yandex.cloud.iam.v1.ICreateIamTokenRequest) {
            return this.api.create(request)
        }
    
        destroy() { this.api.end() }
    }

    constructor(iamCredentials: IIamCredentials, sslCredentials?: ISslCredentials) {
        this.iamCredentials = iamCredentials;
        this.sslCredentials = sslCredentials || makeDefaultSslCredentials()
        this.tokenTimestamp = null;
    }

    getJwtRequest() {
        const now = DateTime.utc();
        const expires = now.plus({milliseconds: this.jwtExpirationTimeout});
        const payload = {
            "iss": this.iamCredentials.serviceAccountId,
            "aud": "https://iam.api.cloud.yandex.net/iam/v1/tokens",
            "iat": Math.round(now.toSeconds()),
            "exp": Math.round(expires.toSeconds())
        };
        const options: jwt.SignOptions = {
            algorithm: "PS256",
            keyid: this.iamCredentials.accessKeyId
        };
        return jwt.sign(payload, this.iamCredentials.privateKey, options);
    }

    private get expired() {
        return !this.tokenTimestamp || (
            DateTime.utc().diff(this.tokenTimestamp).valueOf() > this.tokenExpirationTimeout
        );
    }

    private async sendTokenRequest(): Promise<ICreateIamTokenResponse> {
        let runtimeIamAuthService = new this.GrpcService(this.iamCredentials, this.sslCredentials)
        const tokenPromise = runtimeIamAuthService.create({jwt: this.getJwtRequest()});
        const result = await withTimeout<ICreateIamTokenResponse>(tokenPromise, this.tokenRequestTimeout);
        runtimeIamAuthService.destroy()
        return result
    }

    private async updateToken() {
        this.tokenUpdateInProgress = true
        const {iamToken} = await this.sendTokenRequest();
        if (iamToken) {
            this.token = iamToken;
            this.tokenTimestamp = DateTime.utc();
            this.tokenUpdateInProgress = false
        } else {
            this.tokenUpdateInProgress = false
            throw new Error('Received empty token from IAM!');
        }
    }

    private async waitUntilTokenUpdated() {
        while (this.tokenUpdateInProgress) { await sleep(1) }
        return
    }

    public async getAuthMetadata(): Promise<grpc.Metadata> {
        if (this.expired) {
            // block updateToken calls while token updating
            if(this.tokenUpdateInProgress) await this.waitUntilTokenUpdated()
            else await this.updateToken();
        }
        return makeCredentialsMetadata(this.token);
    }
}

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
            return makeCredentialsMetadata(token);
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
            return makeCredentialsMetadata(token);
        }
        throw new Error(`Failed to fetch access token via metadata service in ${MAX_TRIES} tries!`);
    }
}
