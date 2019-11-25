import fs from 'fs';
import path from 'path';
import grpc from 'grpc';
import jwt from 'jsonwebtoken';
import {DateTime} from 'luxon';
import {GrpcService, ISslCredentials} from "./utils";
import {NIam} from "../proto/bundle";
import TTokenService = NIam.TTokenService;
import ITGetTokenReply = NIam.ITGetTokenReply;


function readToken(pathname: string) {
    if (fs.existsSync(pathname)) {
        const token = fs.readFileSync(pathname);
        return String(token).trim();
    } else {
        return '';
    }
}

const OAUTH_TOKEN = readToken(path.resolve(__dirname, '../secrets/oauth.token'));

function getCredentialsMetadata(token = OAUTH_TOKEN): grpc.Metadata {
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

interface IAuthCredentials {
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
    getAuthMetadata: () => Promise<grpc.Metadata>
}

export class OauthAuthService implements IAuthService {
    public async getAuthMetadata(): Promise<grpc.Metadata> {
        return getCredentialsMetadata();
    }
}

class IAmAuthService extends GrpcService<TTokenService> implements IAuthService {
    private jwtExpirationTimeout = 3600 * 1000;
    private tokenExpirationTimeout = 120 * 1000;
    private tokenRequestTimeout = 10 * 1000;
    private token: string|null|undefined;
    private tokenTimestamp: DateTime|null;

    private readonly iamCredentials: IIAmCredentials;

    constructor(authCredentials: IAuthCredentials) {
        super(
            authCredentials.iamCredentials.iamEndpoint,
            'NIam.TTokenService',
            TTokenService,
            authCredentials.sslCredentials
        );
        this.iamCredentials = authCredentials.iamCredentials;
        this.token = null;
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

    private sendTokenRequest(): Promise<ITGetTokenReply> {
        const timedReject = new Promise((_, reject) => {
            setTimeout(reject, this.tokenRequestTimeout);
        });
        const tokenPromise = this.api.getToken({jwt: this.getJwtRequest()});
        return Promise.race([timedReject, tokenPromise]) as Promise<ITGetTokenReply>;
    }

    private async updateToken() {
        const {iamToken} = await this.sendTokenRequest();
        this.token = iamToken;
        this.tokenTimestamp = DateTime.utc();
    }

    public async getAuthMetadata(): Promise<grpc.Metadata> {
        if (this.expired) {
            await this.updateToken();
        }
        return getCredentialsMetadata(this.token as string);
    }
}

const ROOT_CERTS = fs.readFileSync('/usr/share/yandex-internal-root-ca/yacloud.pem');
const IAM_ENDPOINT = 'iam.api.cloud.yandex.net:443';

export const authService = new IAmAuthService({
    sslCredentials: {
        rootCertificates: ROOT_CERTS
    },
    iamCredentials: {
        iamEndpoint: IAM_ENDPOINT,
        serviceAccountId: 'ajejpgcj4cr6f2a6be9u',
        accessKeyId: 'aje2krmo97mhinhb7r44',
        privateKey: fs.readFileSync(path.resolve(__dirname, '../secrets/auth_hidden_key'))
    }
});
