/// <reference types="node" />
import * as grpc from '@grpc/grpc-js';
import { ISslCredentials } from './ssl-credentials';
export interface IIamCredentials {
    serviceAccountId: string;
    accessKeyId: string;
    privateKey: Buffer;
    iamEndpoint: string;
}
interface ITokenServiceYC {
    getToken: () => Promise<string>;
}
interface ITokenServiceCompat {
    getToken: () => string | undefined;
    initialize?: () => Promise<void>;
}
export declare type ITokenService = ITokenServiceYC | ITokenServiceCompat;
export interface IAuthService {
    getAuthMetadata: () => Promise<grpc.Metadata>;
}
export declare class AnonymousAuthService implements IAuthService {
    constructor();
    getAuthMetadata(): Promise<grpc.Metadata>;
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
    tokenExpirationTimeout?: number;
}
export declare class StaticCredentialsAuthService implements IAuthService {
    private readonly tokenRequestTimeout;
    private readonly tokenExpirationTimeout;
    private tokenTimestamp;
    private token;
    private tokenUpdatePromise;
    private user;
    private password;
    private endpoint;
    private sslCredentials;
    constructor(user: string, password: string, endpoint: string, options?: StaticCredentialsAuthOptions);
    private get expired();
    private sendTokenRequest;
    private updateToken;
    getAuthMetadata(): Promise<grpc.Metadata>;
}
export declare class TokenAuthService implements IAuthService {
    private token;
    constructor(token: string);
    getAuthMetadata(): Promise<grpc.Metadata>;
}
export declare class IamAuthService implements IAuthService {
    private jwtExpirationTimeout;
    private tokenExpirationTimeout;
    private tokenRequestTimeout;
    private token;
    private tokenTimestamp;
    private tokenUpdateInProgress;
    private readonly iamCredentials;
    private readonly sslCredentials;
    constructor(iamCredentials: IIamCredentials, sslCredentials?: ISslCredentials);
    getJwtRequest(): string;
    private get expired();
    private sendTokenRequest;
    private updateToken;
    private waitUntilTokenUpdated;
    getAuthMetadata(): Promise<grpc.Metadata>;
}
export declare class MetadataAuthService implements IAuthService {
    private tokenService?;
    private MetadataTokenServiceClass?;
    /** Do not use this, use MetadataAuthService.create */
    constructor(tokenService?: ITokenService);
    /**
     * Load @yandex-cloud/nodejs-sdk and create `MetadataTokenService` if tokenService is not set
     */
    private createMetadata;
    getAuthMetadata(): Promise<grpc.Metadata>;
    private getAuthMetadataCompat;
}
export {};
