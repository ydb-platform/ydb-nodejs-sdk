import fs from 'fs';
import {
    IAuthService,
    TokenAuthService,
    IamAuthService,
    IIAmCredentials,
    // MetadataAuthService
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

export function getCredentialsFromEnv(entryPoint: string, dbName: string, logger: Logger): IAuthService {
    let sslCredentials = undefined;

    if (entryPoint.startsWith('grpcs://')) {
        logger.debug('Protocol grpcs specified in entry-point, using SSL connection.');
        sslCredentials = getSslCert();
    } else if (entryPoint.startsWith('grpc://')) {
        logger.debug('Protocol grpc specified in entry-point, using insecure connection.');
    } else {
        logger.debug('No protocol specified in entry-point, using SSL connection.')
        sslCredentials = getSslCert();
    }

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
        throw new Error('You have to privide either YDB_TOKEN or SA_ID');
        // logger.debug('Neither YDB_TOKEN nor SA_ID env variable is set, getting token from Metadata Service');
        // return new MetadataAuthService(dbName, sslCredentials);
    }
}
