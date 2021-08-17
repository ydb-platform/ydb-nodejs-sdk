import fs from 'fs';
import path from 'path';
import {
    AnonymousAuthService,
    IamAuthService,
    IAuthService,
    IIAmCredentials,
    MetadataAuthService,
    TokenAuthService
} from "./credentials";
import {ISslCredentials} from "./utils";
import {Logger} from './logging';

const FALLBACK_INTERNAL_ROOT_CERTS = path.join(__dirname, '../proto/certs/internal.pem');
const FALLBACK_SYSTEM_ROOT_CERTS = path.join(__dirname, '../proto/certs/system.pem');

function getSslCert(useInternalCertificate: boolean, rootCertificates?: Buffer): ISslCredentials {
    if (rootCertificates) {
        return {rootCertificates};
    }

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

export function getCredentialsFromEnv(entryPoint: string, dbName: string, logger: Logger, rootCertificates?: Buffer): IAuthService {
    function getOldSslCredentials() {
        return getSslCredentials(entryPoint, logger, false);
    }
    function getNewSslCredentials() {
        return getSslCredentials(entryPoint, logger, true, rootCertificates);
    }

    if (process.env.YDB_TOKEN) {
        logger.warn('deprecated YDB_TOKEN env var found, using TokenAuthService.');
        return new TokenAuthService(process.env.YDB_TOKEN, dbName, getOldSslCredentials());
    }
    if (process.env.SA_ID) {
        logger.warn('deprecated SA_ID env var found, using IamAuthService.');
        return new IamAuthService(getSACredentialsFromEnv(process.env.SA_ID), dbName, getOldSslCredentials());
    }
    if (process.env.SA_JSON_FILE) {
        logger.warn('deprecated SA_JSON_FILE env var found, using IamAuthService with params from that json.');
        return new IamAuthService(getSACredentialsFromJson(process.env.SA_JSON_FILE), dbName, getOldSslCredentials());
    }
    if (process.env.YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS) {
        logger.debug('YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS env var found, using IamAuthService with params from that json file.');
        return new IamAuthService(getSACredentialsFromJson(process.env.YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS), dbName, getNewSslCredentials());
    }
    if (process.env.YDB_ANONYMOUS_CREDENTIALS === '1') {
        logger.debug('YDB_ANONYMOUS_CREDENTIALS env var found, using AnonymousAuthService.');
        return new AnonymousAuthService();
    }
    if (process.env.YDB_METADATA_CREDENTIALS === '1') {
        logger.debug('YDB_METADATA_CREDENTIALS env var found, using MetadataAuthService.');
        return new MetadataAuthService(dbName, getNewSslCredentials());
    }
    if (process.env.YDB_ACCESS_TOKEN_CREDENTIALS) {
        logger.debug('YDB_ACCESS_TOKEN_CREDENTIALS env var found, using TokenAuthService.');
        return new TokenAuthService(process.env.YDB_ACCESS_TOKEN_CREDENTIALS, dbName, getNewSslCredentials());
    }
    logger.debug('Neither known env variable is set, getting token from Metadata Service');
    return new MetadataAuthService(dbName, getNewSslCredentials());
}
