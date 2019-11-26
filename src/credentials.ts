import grpc from 'grpc';
import jwt from 'jsonwebtoken';
import {DateTime} from 'luxon';
import {GrpcService, ISslCredentials} from "./utils";
import {NIam} from "../proto/bundle";
import TTokenService = NIam.TTokenService;
import ITGetTokenReply = NIam.ITGetTokenReply;


function makeCredentialsMetadata(token: string): grpc.Metadata {
    const metadata = new grpc.Metadata();
    metadata.add('x-ydb-auth-ticket', token);
    return metadata;
}

interface IIAmCredentials {
    serviceAccountId: string,
    accessKeyId: string,
    privateKey: Buffer,
    iamEndpoint: string
}

export interface IAuthCredentials {
    sslCredentials: ISslCredentials,
    iamCredentials: IIAmCredentials
}

// def get_jwt(service_account_id, access_key_id, private_key, jwt_expiration_timeout):
// now = time.time()
// now_utc = datetime.utcfromtimestamp(now)
// exp_utc = datetime.utcfromtimestamp(now + jwt_expiration_timeout)
// return jwt.encode(
//     key=private_key, algorithm="PS256", headers={"typ": "JWT", "alg": "PS256", "kid": access_key_id},
//     payload={
//         "iss": service_account_id,
//         "aud": "https://iam.api.cloud.yandex.net/iam/v1/tokens", "iat": now_utc, "exp": exp_utc
//     }
// )

export interface IAuthService {
    getAuthMetadata: () => Promise<grpc.Metadata>,
    sslCredentials?: ISslCredentials
}

export class TokenAuthService implements IAuthService {
    constructor(private token: string) {}

    public async getAuthMetadata(): Promise<grpc.Metadata> {
        return makeCredentialsMetadata(this.token);
    }
}

export class IamAuthService extends GrpcService<TTokenService> implements IAuthService {
    private jwtExpirationTimeout = 3600 * 1000;
    private tokenExpirationTimeout = 120 * 1000;
    private tokenRequestTimeout = 10 * 1000;
    private token: string = '';
    private tokenTimestamp: DateTime|null;
    private readonly iamCredentials: IIAmCredentials;

    public readonly sslCredentials: ISslCredentials;

    constructor(authCredentials: IAuthCredentials) {
        super(
            authCredentials.iamCredentials.iamEndpoint,
            'NIam.TTokenService',
            TTokenService,
            authCredentials.sslCredentials
        );
        this.iamCredentials = authCredentials.iamCredentials;
        this.tokenTimestamp = null;

        this.sslCredentials = authCredentials.sslCredentials;
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

    private sendTokenRequest(): Promise<ITGetTokenReply> {
        const timedReject = new Promise((_, reject) => {
            setTimeout(reject, this.tokenRequestTimeout);
        });
        const tokenPromise = this.api.getToken({jwt: this.getJwtRequest()});
        return Promise.race([timedReject, tokenPromise]) as Promise<ITGetTokenReply>;
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
