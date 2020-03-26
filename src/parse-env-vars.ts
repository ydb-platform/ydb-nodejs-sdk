import fs from 'fs';
import {IAuthService, TokenAuthService, IamAuthService, IIAmCredentials} from "./credentials";
import {ISslCredentials} from "./utils";


function getSslCert(): ISslCredentials {
    const rootCertsFile = process.env.YDB_SSL_ROOT_CERTIFICATES_FILE || '';
    const sslCredentials: ISslCredentials = {};
    if (rootCertsFile) {
        sslCredentials.rootCertificates = fs.readFileSync(rootCertsFile);
    }
    return sslCredentials;
}

function getSACredentialsFromEnv(serviceAccountId: string): IIAmCredentials {
    return {
        iamEndpoint: process.env.IAM_ENDPOINT || 'iam.api.cloud.yandex.net:443',
        serviceAccountId,
        accessKeyId: process.env.SA_ACCESS_KEY_ID || '',
        privateKey: fs.readFileSync(process.env.SA_PRIVATE_KEY_FILE || '')
    };
}

function getSACredentialsFromJson(filename: string): IIAmCredentials {
    const buffer = fs.readFileSync(filename);
    const payload = JSON.parse(buffer.toString());
    return {
        iamEndpoint: process.env.IAM_ENDPOINT || 'iam.api.cloud.yandex.net:443',
        serviceAccountId: payload.service_account_id,
        accessKeyId: payload.id,
        privateKey: payload.private_key
    };
}

export function getCredentialsFromEnv(): IAuthService {
    if (process.env.YDB_TOKEN) {
        return new TokenAuthService(process.env.YDB_TOKEN);
    }

    const sslCredentials = getSslCert();
    if (process.env.SA_ID) {
        return new IamAuthService({
            sslCredentials,
            iamCredentials: getSACredentialsFromEnv(process.env.SA_ID)
        });
    } else if (process.env.SA_JSON_FILE) {
        return new IamAuthService({
            sslCredentials,
            iamCredentials: getSACredentialsFromJson(process.env.SA_JSON_FILE)
        });
    }

    throw new Error('Either YDB_TOKEN or SA_ID environment variable should be set!');
}
