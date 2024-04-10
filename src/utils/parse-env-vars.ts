import fs from 'fs';
import {Logger} from '../logger/simple-logger';
import {IamAuthService, IIamCredentials} from "../credentials/iam-auth-service";
import {MetadataAuthService} from "../credentials/metadata-auth-service";
import {TokenAuthService} from "../credentials/token-auth-service";
import {AnonymousAuthService} from "../credentials/anonymous-auth-service";
import {IAuthService} from "../credentials/i-auth-service";
import {getDefaultLogger} from "../logger/getDefaultLogger";

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

export function getCredentialsFromEnv(logger?: Logger): IAuthService {
    logger = logger || getDefaultLogger();
    if (process.env.YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS) {
        logger.debug('YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS env var found, using IamAuthService with params from that json file.');
        return new IamAuthService(getSACredentialsFromJson(process.env.YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS));
    }
    if (process.env.YDB_ANONYMOUS_CREDENTIALS === '1') {
        logger.debug('YDB_ANONYMOUS_CREDENTIALS env var found, using AnonymousAuthService.');
        return new AnonymousAuthService();
    }
    if (process.env.YDB_METADATA_CREDENTIALS === '1') {
        logger.debug('YDB_METADATA_CREDENTIALS env var found, using MetadataAuthService.');
        return new MetadataAuthService();
    }
    if (process.env.YDB_ACCESS_TOKEN_CREDENTIALS) {
        logger.debug('YDB_ACCESS_TOKEN_CREDENTIALS env var found, using TokenAuthService.');
        return new TokenAuthService(process.env.YDB_ACCESS_TOKEN_CREDENTIALS);
    }
    logger.debug('Neither known env variable is set, getting token from Metadata Service');
    return new MetadataAuthService();
}
