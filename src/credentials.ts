import grpc from 'grpc';
import jwt from 'jsonwebtoken';
import {DateTime} from 'luxon';
import {GrpcService, ISslCredentials} from "./utils";
import {TokenService} from 'yandex-cloud';
import {yandex} from "../proto/bundle";
import IamTokenService = yandex.cloud.iam.v1.IamTokenService;
import ICreateIamTokenResponse = yandex.cloud.iam.v1.ICreateIamTokenResponse;


function makeCredentialsMetadata(token: string): grpc.Metadata {
    const metadata = new grpc.Metadata();
    metadata.add('x-ydb-auth-ticket', token);
    return metadata;
}

async function sleep(milliseconds: number) {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export interface IIAmCredentials {
    serviceAccountId: string,
    accessKeyId: string,
    privateKey: Buffer,
    iamEndpoint: string
}

export interface IAuthCredentials {
    sslCredentials: ISslCredentials,
    iamCredentials: IIAmCredentials
}

export interface IAuthService {
    getAuthMetadata: () => Promise<grpc.Metadata>,
    sslCredentials?: ISslCredentials
}

export class TokenAuthService implements IAuthService {
    constructor(private token: string, public sslCredentials?: ISslCredentials) {}

    public async getAuthMetadata(): Promise<grpc.Metadata> {
        return makeCredentialsMetadata(this.token);
    }
}

export class IamAuthService extends GrpcService<IamTokenService> implements IAuthService {
    private jwtExpirationTimeout = 3600 * 1000;
    private tokenExpirationTimeout = 120 * 1000;
    private tokenRequestTimeout = 10 * 1000;
    private token: string = '';
    private tokenTimestamp: DateTime|null;
    private readonly iamCredentials: IIAmCredentials;

    public readonly sslCredentials?: ISslCredentials;

    constructor(iamCredentials: IIAmCredentials, sslCredentials?: ISslCredentials) {
        super(
            iamCredentials.iamEndpoint,
            'yandex.cloud.iam.v1.IamTokenService',
            IamTokenService,
            sslCredentials
        );
        this.iamCredentials = iamCredentials;
        this.tokenTimestamp = null;

        this.sslCredentials = sslCredentials;
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

    private sendTokenRequest(): Promise<ICreateIamTokenResponse> {
        const timedReject = new Promise((_, reject) => {
            setTimeout(reject, this.tokenRequestTimeout);
        });
        const tokenPromise = this.api.create({jwt: this.getJwtRequest()});
        return Promise.race([timedReject, tokenPromise]) as Promise<ICreateIamTokenResponse>;
    }

    private async updateToken() {
        const {iamToken} = await this.sendTokenRequest();
        if (iamToken) {
            this.token = iamToken;
            this.tokenTimestamp = DateTime.utc();
        } else {
            throw new Error('Received empty token from IAM!');
        }
    }

    public async getAuthMetadata(): Promise<grpc.Metadata> {
        if (this.expired) {
            await this.updateToken();
        }
        return makeCredentialsMetadata(this.token);
    }
}

export class MetadataAuthService implements IAuthService {
    private tokenService: any;

    static MAX_TRIES = 5;
    static TRIES_INTERVAL = 2000;

    constructor(public sslCredentials?: ISslCredentials) {
        this.tokenService = new TokenService();
    }

    public async getAuthMetadata(): Promise<grpc.Metadata> {
        let token: string|null = null;
        let tries = 0;
        const MAX_TRIES = 5;
        while (!token && tries < MetadataAuthService.MAX_TRIES) {
            token = this.tokenService.getToken();
            await sleep(MetadataAuthService.TRIES_INTERVAL);
            tries++;
        }
        if (token) {
            return makeCredentialsMetadata(token);
        }
        throw new Error(`Failed to fetch access token via metadata service in ${MAX_TRIES} tries!`);
    }
}
