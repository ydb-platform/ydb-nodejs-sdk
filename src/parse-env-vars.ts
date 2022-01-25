import fs from 'fs';
import {
    AnonymousAuthService,
    IamAuthService,
    IAuthService,
    IIamCredentials, makeSslCredentials,
    MetadataAuthService,
    TokenAuthService
} from "./credentials";
import {ISslCredentials} from "./utils";
import {Logger} from './logging';

function getSslCert(rootCertificates?: Buffer): ISslCredentials {
    if (rootCertificates) {
        return {rootCertificates};
    }

    return makeSslCredentials();
}

export function getSACredentialsFromJson(filename: string): IIamCredentials {
    const buffer = fs.readFileSync(filename);
    const payload = JSON.parse(buffer.toString());
    return {
        iamEndpoint: process.env.IAM_ENDPOINT || 'iam.api.cloud.yandex.net:443',
        serviceAccountId: payload.service_account_id,
        accessKeyId: payload.id,
        privateKey: payload.private_key
    };
}

function getSslCredentialsImpl(endpoint: string, logger: Logger, rootCertificates?: Buffer) {
    if (endpoint.startsWith('grpcs://')) {
        logger.debug('Protocol grpcs specified in endpoint, using SSL connection.');
        return getSslCert(rootCertificates);
    }
    if (endpoint.startsWith('grpc://')) {
        logger.debug('Protocol grpc specified in endpoint, using insecure connection.');
        return undefined;
    }
    logger.debug('No protocol specified in endpoint, using SSL connection.')
    return getSslCert(rootCertificates);
}

export function getCredentialsFromEnv(endpoint: string, database: string, logger: Logger, rootCertificates?: Buffer): IAuthService {
    function getSslCredentials() {
        return getSslCredentialsImpl(endpoint, logger, rootCertificates);
    }

    if (process.env.YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS) {
        logger.debug('YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS env var found, using IamAuthService with params from that json file.');
        return new IamAuthService(getSACredentialsFromJson(process.env.YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS), database, getSslCredentials());
    }
    if (process.env.YDB_ANONYMOUS_CREDENTIALS === '1') {
        logger.debug('YDB_ANONYMOUS_CREDENTIALS env var found, using AnonymousAuthService.');
        return new AnonymousAuthService();
    }
    if (process.env.YDB_METADATA_CREDENTIALS === '1') {
        logger.debug('YDB_METADATA_CREDENTIALS env var found, using MetadataAuthService.');
        return new MetadataAuthService(database, getSslCredentials());
    }
    if (process.env.YDB_ACCESS_TOKEN_CREDENTIALS) {
        logger.debug('YDB_ACCESS_TOKEN_CREDENTIALS env var found, using TokenAuthService.');
        return new TokenAuthService(process.env.YDB_ACCESS_TOKEN_CREDENTIALS, database, getSslCredentials());
    }
    logger.debug('Neither known env variable is set, getting token from Metadata Service');
    return new MetadataAuthService(database, getSslCredentials());
}
