import {Ydb} from "ydb-sdk-proto";
import AuthServiceResult = Ydb.Auth.LoginResult;
import {ISslCredentials} from "../utils/ssl-credentials";
import {GrpcService, withTimeout} from "../utils";
import {retryable} from "../retries_obsoleted";
import {DateTime} from "luxon";
import {getOperationPayload} from "../utils/process-ydb-operation-result";
import * as grpc from "@grpc/grpc-js";
import {addCredentialsToMetadata} from "./add-credentials-to-metadata";

import {IAuthService} from "./i-auth-service";
import {HasLogger} from "../logger/has-logger";
import {Logger} from "../logger/simple-logger";
import {getDefaultLogger} from "../logger/get-default-logger";

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

class StaticCredentialsGrpcService extends GrpcService<Ydb.Auth.V1.AuthService> implements HasLogger {
    constructor(endpoint: string, sslCredentials?: ISslCredentials, public readonly logger: Logger = getDefaultLogger()) {
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

export class StaticCredentialsAuthService implements IAuthService {
    private readonly tokenRequestTimeout = 10 * 1000;
    private readonly tokenExpirationTimeout = 6 * 60 * 60 * 1000;
    private tokenTimestamp: DateTime | null;
    private token: string = '';
    private tokenUpdatePromise: Promise<any> | null = null;
    private user: string;
    private password: string;
    private endpoint: string;
    private sslCredentials: ISslCredentials | undefined;
    public readonly logger: Logger;

    constructor(
        user: string,
        password: string,
        endpoint: string,
        options?: StaticCredentialsAuthOptions
    );
    constructor(
        user: string,
        password: string,
        endpoint: string,
        loggerOrOptions: Logger | StaticCredentialsAuthOptions,
        options?: StaticCredentialsAuthOptions
    );
    constructor(
        user: string,
        password: string,
        endpoint: string,
        loggerOrOptions?: Logger | StaticCredentialsAuthOptions,
        options?: StaticCredentialsAuthOptions
    ) {
        this.tokenTimestamp = null;
        this.user = user;
        this.password = password;
        this.endpoint = endpoint;
        this.sslCredentials = options?.sslCredentials;
        if (typeof loggerOrOptions === 'object' && loggerOrOptions !== null && 'error' in loggerOrOptions) {
            this.logger = loggerOrOptions as Logger;
        } else {
            options = loggerOrOptions;
            this.logger = getDefaultLogger();
        }
        if (options?.tokenRequestTimeout) this.tokenRequestTimeout = options.tokenRequestTimeout;
        if (options?.tokenExpirationTimeout) this.tokenExpirationTimeout = options.tokenExpirationTimeout;
    }

    private get expired() {
        return !this.tokenTimestamp || (
            DateTime.utc().diff(this.tokenTimestamp).valueOf() > this.tokenExpirationTimeout
        );
    }

    private async sendTokenRequest(): Promise<AuthServiceResult> {
        let runtimeAuthService = new StaticCredentialsGrpcService(
            this.endpoint,
            this.sslCredentials,
            this.logger,
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
        const {token} = await this.sendTokenRequest();
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
        return addCredentialsToMetadata(this.token);
    }
}
