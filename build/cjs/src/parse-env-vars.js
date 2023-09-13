"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCredentialsFromEnv = exports.getSACredentialsFromJson = void 0;
const fs_1 = __importDefault(require("fs"));
const credentials_1 = require("./credentials");
const logging_1 = require("./logging");
function getSACredentialsFromJson(filename) {
    const buffer = fs_1.default.readFileSync(filename);
    const payload = JSON.parse(buffer.toString());
    return {
        iamEndpoint: process.env.IAM_ENDPOINT || 'iam.api.cloud.yandex.net:443',
        serviceAccountId: payload.service_account_id,
        accessKeyId: payload.id,
        privateKey: payload.private_key
    };
}
exports.getSACredentialsFromJson = getSACredentialsFromJson;
function getCredentialsFromEnv(logger) {
    logger = logger || (0, logging_1.getLogger)();
    if (process.env.YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS) {
        logger.debug('YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS env var found, using IamAuthService with params from that json file.');
        return new credentials_1.IamAuthService(getSACredentialsFromJson(process.env.YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS));
    }
    if (process.env.YDB_ANONYMOUS_CREDENTIALS === '1') {
        logger.debug('YDB_ANONYMOUS_CREDENTIALS env var found, using AnonymousAuthService.');
        return new credentials_1.AnonymousAuthService();
    }
    if (process.env.YDB_METADATA_CREDENTIALS === '1') {
        logger.debug('YDB_METADATA_CREDENTIALS env var found, using MetadataAuthService.');
        return new credentials_1.MetadataAuthService();
    }
    if (process.env.YDB_ACCESS_TOKEN_CREDENTIALS) {
        logger.debug('YDB_ACCESS_TOKEN_CREDENTIALS env var found, using TokenAuthService.');
        return new credentials_1.TokenAuthService(process.env.YDB_ACCESS_TOKEN_CREDENTIALS);
    }
    logger.debug('Neither known env variable is set, getting token from Metadata Service');
    return new credentials_1.MetadataAuthService();
}
exports.getCredentialsFromEnv = getCredentialsFromEnv;
