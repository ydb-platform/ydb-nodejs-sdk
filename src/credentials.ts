import fs from 'fs';
import path from 'path';
import grpc from 'grpc';
import jwt from 'jsonwebtoken';
import {DateTime} from 'luxon';
import {GrpcService, ISslCredentials, sleep, withTimeout} from "./utils";
import {TokenService} from 'yandex-cloud';
import {yandex} from "ydb-sdk-proto";
import IamTokenService = yandex.cloud.iam.v1.IamTokenService;
import ICreateIamTokenResponse = yandex.cloud.iam.v1.ICreateIamTokenResponse;

const FALLBACK_INTERNAL_ROOT_CERTS = path.join(__dirname, '../certs/internal.pem');
const FALLBACK_SYSTEM_ROOT_CERTS = path.join(__dirname, '../certs/system.pem');

export function makeSslCredentials(useInternalCertificate: boolean = true): ISslCredentials {
    const sslCredentials: ISslCredentials = {};
    if (process.env.YDB_SSL_ROOT_CERTIFICATES_FILE) {
        sslCredentials.rootCertificates = fs.readFileSync(process.env.YDB_SSL_ROOT_CERTIFICATES_FILE);
    } else if (useInternalCertificate) {
        const internalRootCertificates = fs.readFileSync(FALLBACK_INTERNAL_ROOT_CERTS);

        let systemRootCertificates;
        const tls = require('tls');
        const nodeRootCertificates = tls.rootCertificates as string[] | undefined;
        if (nodeRootCertificates && nodeRootCertificates.length > 0) {
            systemRootCertificates = Buffer.from(nodeRootCertificates.join('\n'));
        } else {
            systemRootCertificates = fs.readFileSync(FALLBACK_SYSTEM_ROOT_CERTS);
        }

        sslCredentials.rootCertificates = Buffer.concat([internalRootCertificates, systemRootCertificates]);
    }
    return sslCredentials;
}

function makeDbMetadata(dbName: string): grpc.Metadata {
    const metadata = new grpc.Metadata();
    metadata.add('x-ydb-database', dbName);
    return metadata;
}

function makeCredentialsMetadata(token: string, dbName: string): grpc.Metadata {
    const metadata = makeDbMetadata(dbName);
    metadata.add('x-ydb-auth-ticket', token);
    return metadata;
}

export interface IIamCredentials {
    serviceAccountId: string,
    accessKeyId: string,
    privateKey: Buffer,
    iamEndpoint: string
}

export interface ITokenService {
    getToken: () => string|undefined;
    initialize?: () => Promise<void>;
}

export interface IAuthService {
    getAuthMetadata: () => Promise<grpc.Metadata>,
    sslCredentials?: ISslCredentials
}

export class AnonymousAuthService implements IAuthService {
    constructor(private dbName = '/local') {}
    public async getAuthMetadata(): Promise<grpc.Metadata> {
        return makeDbMetadata(this.dbName);
    }
}

export class TokenAuthService implements IAuthService {
    constructor(private token: string, private dbName: string, public sslCredentials?: ISslCredentials) {}

    public async getAuthMetadata(): Promise<grpc.Metadata> {
        return makeCredentialsMetadata(this.token, this.dbName);
    }
}

export class IamAuthService extends GrpcService<IamTokenService> implements IAuthService {
    private jwtExpirationTimeout = 3600 * 1000;
    private tokenExpirationTimeout = 120 * 1000;
    private tokenRequestTimeout = 10 * 1000;
    private token: string = '';
    private readonly dbName: string = '';
    private tokenTimestamp: DateTime|null;
    private readonly iamCredentials: IIamCredentials;

    public readonly sslCredentials?: ISslCredentials;

    constructor(iamCredentials: IIamCredentials, dbName: string, sslCredentials?: ISslCredentials) {
        super(
            iamCredentials.iamEndpoint,
            'yandex.cloud.iam.v1.IamTokenService',
            IamTokenService,
            sslCredentials
        );
        this.iamCredentials = iamCredentials;
        this.dbName = dbName;
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
        const tokenPromise = this.api.create({jwt: this.getJwtRequest()});
        return withTimeout<ICreateIamTokenResponse>(tokenPromise, this.tokenRequestTimeout);
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
        return makeCredentialsMetadata(this.token, this.dbName);
    }
}

export class MetadataAuthService implements IAuthService {
    private tokenService: ITokenService;
    public readonly sslCredentials: ISslCredentials;

    static MAX_TRIES = 5;
    static TRIES_INTERVAL = 2000;

    constructor(private dbName: string, sslCredentials?: ISslCredentials, tokenService?: ITokenService) {
        this.tokenService = tokenService || new TokenService();
        this.sslCredentials = sslCredentials || makeSslCredentials();
    }

    public async getAuthMetadata(): Promise<grpc.Metadata> {
        let token = this.tokenService.getToken();
        if (!token && typeof this.tokenService.initialize === 'function') {
            await this.tokenService.initialize();
            token = this.tokenService.getToken();
        }
        let tries = 0;
        while (!token && tries < MetadataAuthService.MAX_TRIES) {
            await sleep(MetadataAuthService.TRIES_INTERVAL);
            tries++;
            token = this.tokenService.getToken();
        }
        if (token) {
            return makeCredentialsMetadata(token, this.dbName);
        }
        throw new Error(`Failed to fetch access token via metadata service in ${MetadataAuthService.MAX_TRIES} tries!`);
    }
}
