import fs from 'fs';
import path from 'path';
import {
    IAuthService,
    TokenAuthService,
    IamAuthService,
    IIAmCredentials,
    MetadataAuthService, AnonymousAuthService
} from "./credentials";
import {ISslCredentials} from "./utils";
import {Logger} from './logging';

const FALLBACK_ROOT_CERTS = path.join(__dirname, '../proto/certs/CA.pem');

function getSslCert(useInternalCertificate: boolean, rootCertificates?: Buffer): ISslCredentials {
    if (rootCertificates) {
        return {rootCertificates};
    }

    const rootCertsFile = process.env.YDB_SSL_ROOT_CERTIFICATES_FILE || (useInternalCertificate ? FALLBACK_ROOT_CERTS : '');
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

function getSslCredentials(entryPoint: string, logger: Logger, useInternalCertificate: boolean, rootCertificates?: Buffer) {
    if (entryPoint.startsWith('grpcs://')) {
        logger.debug('Protocol grpcs specified in entry-point, using SSL connection.');
        return getSslCert(useInternalCertificate, rootCertificates);
    }
    if (entryPoint.startsWith('grpc://')) {
        logger.debug('Protocol grpc specified in entry-point, using insecure connection.');
        return undefined;
    }
    logger.debug('No protocol specified in entry-point, using SSL connection.')
    return getSslCert(useInternalCertificate, rootCertificates);
}

export function getCredentialsFromEnv(entryPoint: string, dbName: string, logger: Logger): IAuthService {
    let sslCredentials = getSslCredentials(entryPoint, logger, false);

    if (process.env.YDB_TOKEN) {
        logger.debug('YDB_TOKEN env var found, using TokenAuthService.');
        return new TokenAuthService(process.env.YDB_TOKEN, dbName, sslCredentials);
    }

    if (process.env.SA_ID) {
        logger.debug('SA_ID env var found, using IamAuthService.');
        return new IamAuthService(getSACredentialsFromEnv(process.env.SA_ID), dbName, sslCredentials);
    } else if (process.env.SA_JSON_FILE) {
        logger.debug('SA_JSON_FILE env var found, using IamAuthService with params from that json.');
        return new IamAuthService(getSACredentialsFromJson(process.env.SA_JSON_FILE), dbName, sslCredentials);
    } else {
        logger.debug('Neither YDB_TOKEN nor SA_ID env variable is set, getting token from Metadata Service');
        return new MetadataAuthService(dbName, sslCredentials);
    }
}

export function getCredentialsFromEnvNew(entryPoint: string, dbName: string, logger: Logger, rootCertificates?: Buffer): IAuthService {
    const sslCredentials = getSslCredentials(entryPoint, logger, true, rootCertificates);

    if (process.env.YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS) {
        logger.debug('YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS env var found, using IamAuthService with params from that json file.');
        return new IamAuthService(getSACredentialsFromJson(process.env.YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS), dbName, sslCredentials);
    }

    if (process.env.YDB_ANONYMOUS_CREDENTIALS === '1') {
        logger.debug('YDB_ANONYMOUS_CREDENTIALS env var found, using MetadataAuthService.');
        return new AnonymousAuthService();
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

    logger.debug('Neither YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS, YDB_ANONYMOUS_CREDENTIALS, YDB_METADATA_CREDENTIALS nor YDB_ACCESS_TOKEN_CREDENTIALS env variable is set, getting token from Metadata Service');
    return new MetadataAuthService(dbName, sslCredentials);
}
