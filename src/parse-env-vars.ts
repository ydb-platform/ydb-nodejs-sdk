import fs from 'fs';
import {
    IAuthService,
    TokenAuthService,
    IamAuthService,
    IIAmCredentials,
    MetadataAuthService,
    AnonymousAuthService,
} from "./credentials";
import {ISslCredentials} from "./utils";
import {Logger} from './logging';


function getSslCert(): ISslCredentials {
    const rootCertsFile = process.env.YDB_SSL_ROOT_CERTIFICATES_FILE || '';
    const sslCredentials: ISslCredentials = {};
    if (rootCertsFile) {
        sslCredentials.rootCertificates = fs.readFileSync(rootCertsFile);
    }
    return sslCredentials;
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

function getSslCredentials(entryPoint: string, logger: Logger) {
    let sslCredentials = undefined;

    if (entryPoint.startsWith('grpcs://')) {
        logger.debug('Protocol grpcs specified in entry-point, using SSL connection.');
        return getSslCert();
    } else if (entryPoint.startsWith('grpc://')) {
        logger.debug('Protocol grpc specified in entry-point, using insecure connection.');
    } else {
        logger.debug('No protocol specified in entry-point, using SSL connection.')
        return getSslCert();
    }

    return sslCredentials;
}

export function getCredentialsFromEnv(entryPoint: string, dbName: string, logger: Logger): IAuthService {
    if (process.env.YDB_ANONYMOUS_CREDENTIALS === '1') {
        logger.debug('YDB_ANONYMOUS_CREDENTIALS env var found, using MetadataAuthService.');
        return new AnonymousAuthService();
    }

    const sslCredentials = getSslCredentials(entryPoint, logger);

    if (process.env.YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS) {
        logger.debug('YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS env var found, using IamAuthService with params from that json file.');
        return new IamAuthService(getSACredentialsFromJson(process.env.YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS), dbName, sslCredentials);
    }

    if (process.env.YDB_METADATA_CREDENTIALS === '1') {
        logger.debug('YDB_METADATA_CREDENTIALS env var found, using MetadataAuthService.');
        return new MetadataAuthService(dbName, sslCredentials);
    }

    const accessToken = process.env.YDB_ACCESS_TOKEN_CREDENTIALS;
    if (accessToken) {
        logger.debug('YDB_ACCESS_TOKEN_CREDENTIALS env var found, using TokenAuthService.');
        return new TokenAuthService(accessToken, dbName, sslCredentials);
    }

    logger.debug('Neither YDB_ANONYMOUS_CREDENTIALS, YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS, YDB_METADATA_CREDENTIALS nor YDB_ACCESS_TOKEN_CREDENTIALS env variable is set, getting token from Metadata Service');
    return new MetadataAuthService(dbName, sslCredentials);
}
