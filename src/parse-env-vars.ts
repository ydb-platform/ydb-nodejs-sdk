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

function getSslCert(useInternalCertificate: boolean, rootCertificates?: Buffer): ISslCredentials {
    if (rootCertificates) {
        return {rootCertificates};
    }

    return makeSslCredentials(useInternalCertificate);
}

function getSACredentialsFromEnv(serviceAccountId: string): IIamCredentials {
    return {
        iamEndpoint: process.env.IAM_ENDPOINT || 'iam.api.cloud.yandex.net:443',
        serviceAccountId,
        accessKeyId: process.env.SA_ACCESS_KEY_ID || '',
        privateKey: fs.readFileSync(process.env.SA_PRIVATE_KEY_FILE || '')
    };
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

function getSslCredentialsImpl(entryPoint: string, logger: Logger, useInternalCertificate: boolean, rootCertificates?: Buffer) {
    if (entryPoint.startsWith('grpcs://')) {
        logger.debug('Protocol grpcs specified in entry-point, using SSL connection.');
        return getSslCert(useInternalCertificate, rootCertificates);
    }
    if (entryPoint.startsWith('grpc://')) {
        logger.debug('Protocol grpc specified in entry-point, using insecure connection.');
        return undefined;
    }
    logger.debug('No protocol specified in entry-point, using SSL connection.');
    return getSslCert(useInternalCertificate, rootCertificates);
}

export function getCredentialsFromEnv(entryPoint: string, dbName: string, logger: Logger, rootCertificates?: Buffer): IAuthService {
    function getOldSslCredentials() {
        return getSslCredentialsImpl(entryPoint, logger, false);
    }

    function getNewSslCredentials() {
        return getSslCredentialsImpl(entryPoint, logger, true, rootCertificates);
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

export type AuthType =
    "YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS" |
    "YDB_ANONYMOUS_CREDENTIALS" |
    "YDB_METADATA_CREDENTIALS" |
    "YDB_IAM_TOKEN_CREDENTIALS";

export interface CredentialsOptions {
    entryPoint: string,
    dbName: string,
    logger: Logger,
    serviceAccountKeyFile?: string,
    IAMtoken?: string,
    rootCertificates?: Buffer
}

/**
 *
 *  type: AuthType,                     // Auth type
 *  options: {
 *      entryPoint: string,             // string like "grpcs://ydb.serverless.yandexcloud.net:2135" (serverless) or ""lb.etn01lrprvnlnhv8v5kj.ydb.mdb.yandexcloud.net:2135" (dedicated)
 *                                      // doc: https://cloud.yandex.ru/docs/ydb/reference/ydb-sdk/yc_setup
 *                                      // you can find endpoint at web console for database
 *      dbName: string,                 // name of database
 *      logger: Logger,
 *      serviceAccountKeyFile?: string, // only for YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS type: name and path of file where you store sa key token
 *      IAMtoken?: string,              // only for YDB_IAM_TOKEN_CREDENTIALS type - IAM token
 *      rootCertificates?: Buffer
 *  }
 */
export function getCredentialsByType(type: AuthType, options: CredentialsOptions): IAuthService {

    function getNewSslCredentials() {
        return getSslCredentialsImpl(options.entryPoint, options.logger, true, options.rootCertificates);
    }

    switch (type) {
        case 'YDB_ANONYMOUS_CREDENTIALS':
            options.logger.debug('YDB_ANONYMOUS_CREDENTIALS , using AnonymousAuthService.');
            return new AnonymousAuthService();
            break;
        case 'YDB_METADATA_CREDENTIALS':
            options.logger.debug('YDB_METADATA_CREDENTIALS , using MetadataAuthService.');
            return new MetadataAuthService(options.dbName, getNewSslCredentials());
            break;
        case 'YDB_IAM_TOKEN_CREDENTIALS':
            options.logger.debug('YDB_IAM_TOKEN_CREDENTIALS , using TokenAuthService.');
            if (!options.IAMtoken) {
                options.logger.error('IAMtoken parameter is not defined, please, pass it.');
                process.exit(500);
            }
            return new TokenAuthService(options.IAMtoken, options.dbName, getNewSslCredentials());
            break;
        case 'YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS':
            options.logger.debug('YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS , using key file with params from that json file.');
            if (!options.serviceAccountKeyFile) {
                options.logger.error('serviceAccountKeyFile parameter is not defined, please, pass it.');
                process.exit(500);
            }
            return new IamAuthService(getSACredentialsFromJson(options.serviceAccountKeyFile), options.dbName, getNewSslCredentials());
            break;
    }
    options.logger.debug('Neither known auth type used, getting token from Metadata Service');
    return new MetadataAuthService(options.dbName, getNewSslCredentials());
}


