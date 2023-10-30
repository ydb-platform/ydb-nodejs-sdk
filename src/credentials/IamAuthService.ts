import { DateTime } from 'luxon';
import jwt from 'jsonwebtoken';
import * as grpc from '@grpc/grpc-js';
import { yandex } from 'ydb-sdk-proto';
import { ISslCredentials, makeDefaultSslCredentials } from '../ssl-credentials';
import { GrpcService, sleep, withTimeout } from '../utils';
import { makeCredentialsMetadata } from './makeCredentialsMetadata';
import { IAuthService } from './IAuthService';
import { IIamCredentials } from './IIamCredentials';
import ICreateIamTokenResponse = yandex.cloud.iam.v1.ICreateIamTokenResponse;
import { retryable } from '../retries';
import IamTokenService = yandex.cloud.iam.v1.IamTokenService;

export class IamAuthService implements IAuthService {
    private jwtExpirationTimeout = 3600 * 1000;
    private tokenExpirationTimeout = 120 * 1000;
    private tokenRequestTimeout = 10 * 1000;
    private token = '';
    private tokenTimestamp: DateTime | null;
    private tokenUpdateInProgress = false;
    private readonly iamCredentials: IIamCredentials;
    private readonly sslCredentials: ISslCredentials;

    constructor(iamCredentials: IIamCredentials, sslCredentials?: ISslCredentials) {
        this.iamCredentials = iamCredentials;
        this.sslCredentials = sslCredentials || makeDefaultSslCredentials();
        this.tokenTimestamp = null;
    }

    getJwtRequest() {
        const now = DateTime.utc();
        const expires = now.plus({ milliseconds: this.jwtExpirationTimeout });
        const payload = {
            iss: this.iamCredentials.serviceAccountId,
            aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
            iat: Math.round(now.toSeconds()),
            exp: Math.round(expires.toSeconds()),
        };
        const options: jwt.SignOptions = {
            algorithm: 'PS256',
            keyid: this.iamCredentials.accessKeyId,
        };

        return jwt.sign(payload, this.iamCredentials.privateKey, options);
    }

    private get expired() {
        return !this.tokenTimestamp || (
            DateTime.utc().diff(this.tokenTimestamp).valueOf() > this.tokenExpirationTimeout
        );
    }

    private async sendTokenRequest(): Promise<ICreateIamTokenResponse> {
        const runtimeIamAuthService = new IamTokenGrpcService(
            this.iamCredentials,
            this.sslCredentials,
        );
        const tokenPromise = runtimeIamAuthService.create({ jwt: this.getJwtRequest() });
        const result = await withTimeout<ICreateIamTokenResponse>(
            tokenPromise,
            this.tokenRequestTimeout,
        );

        runtimeIamAuthService.destroy();

        return result;
    }

    private async updateToken() {
        this.tokenUpdateInProgress = true;
        const { iamToken } = await this.sendTokenRequest();

        if (iamToken) {
            this.token = iamToken;
            this.tokenTimestamp = DateTime.utc();
            this.tokenUpdateInProgress = false;
        } else {
            this.tokenUpdateInProgress = false;
            throw new Error('Received empty token from IAM!');
        }
    }

    private async waitUntilTokenUpdated() {
        while (this.tokenUpdateInProgress) {
            await sleep(1);
        }
    }

    public async getAuthMetadata(): Promise<grpc.Metadata> {
        if (this.expired) {
            // block updateToken calls while token updating
            await (this.tokenUpdateInProgress ? this.waitUntilTokenUpdated() : this.updateToken());
        }

        return makeCredentialsMetadata(this.token);
    }
}

class IamTokenGrpcService extends GrpcService<IamTokenService> {
    constructor(iamCredentials: IIamCredentials, sslCredentials: ISslCredentials) {
        super(
            iamCredentials.iamEndpoint,
            'yandex.cloud.iam.v1.IamTokenService',
            IamTokenService,
            sslCredentials,
        );
    }

    @retryable()
    create(request: yandex.cloud.iam.v1.ICreateIamTokenRequest) {
        return this.api.create(request);
    }

    destroy() {
        this.api.end();
    }
}
