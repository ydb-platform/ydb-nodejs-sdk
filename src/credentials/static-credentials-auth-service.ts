import { Ydb } from 'ydb-sdk-proto';
import { DateTime } from 'luxon';
import * as grpc from '@grpc/grpc-js';
import { GrpcService, withTimeout } from '../utils/service-base-classes';
import { ISslCredentials } from '../ssl-credentials';
import { retryable } from '../retries';
import { makeCredentialsMetadata } from './make-credentials-metadata';
import { IAuthService } from './i-auth-service';
import AuthServiceResult = Ydb.Auth.LoginResult;
import { getOperationPayload } from '../utils/get-operation-payload';

class StaticCredentialsGrpcService extends GrpcService<Ydb.Auth.V1.AuthService> {
    constructor(endpoint: string, sslCredentials?: ISslCredentials) {
        super(endpoint, 'Ydb.Auth.V1.AuthService', Ydb.Auth.V1.AuthService, sslCredentials);
    }

    @retryable()
    login(request: Ydb.Auth.ILoginRequest) {
        return this.api.login(request);
    }

    destroy() {
        this.api.end();
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
    private token = '';
    private tokenUpdatePromise: Promise<any> | null = null;
    private user: string;
    private password: string;
    private endpoint: string;
    private sslCredentials: ISslCredentials | undefined;

    constructor(
        user: string,
        password: string,
        endpoint: string,
        options?: StaticCredentialsAuthOptions,
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
        const runtimeAuthService = new StaticCredentialsGrpcService(
            this.endpoint,
            this.sslCredentials,
        );
        const tokenPromise = runtimeAuthService.login({
            user: this.user,
            password: this.password,
        });
        const response = await withTimeout(tokenPromise, this.tokenRequestTimeout);
        const result = AuthServiceResult.decode(getOperationPayload(response));

        runtimeAuthService.destroy();

        return result;
    }

    private async updateToken() {
        const { token } = await this.sendTokenRequest();

        if (token) {
            this.token = token;
            this.tokenTimestamp = DateTime.utc();
        } else {
            throw new Error('Received empty token from static credentials!');
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
