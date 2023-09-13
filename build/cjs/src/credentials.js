"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataAuthService = exports.IamAuthService = exports.TokenAuthService = exports.StaticCredentialsAuthService = exports.AnonymousAuthService = void 0;
const grpc = __importStar(require("@grpc/grpc-js"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const luxon_1 = require("luxon");
const utils_1 = require("./utils");
const ydb_sdk_proto_1 = require("ydb-sdk-proto");
const ssl_credentials_1 = require("./ssl-credentials");
var IamTokenService = ydb_sdk_proto_1.yandex.cloud.iam.v1.IamTokenService;
var AuthServiceResult = ydb_sdk_proto_1.Ydb.Auth.LoginResult;
const retries_1 = require("./retries");
function makeCredentialsMetadata(token) {
    const metadata = new grpc.Metadata();
    metadata.add('x-ydb-auth-ticket', token);
    return metadata;
}
class AnonymousAuthService {
    constructor() { }
    async getAuthMetadata() {
        return new grpc.Metadata();
    }
}
exports.AnonymousAuthService = AnonymousAuthService;
class StaticCredentialsGrpcService extends utils_1.GrpcService {
    constructor(endpoint, sslCredentials) {
        super(endpoint, 'Ydb.Auth.V1.AuthService', ydb_sdk_proto_1.Ydb.Auth.V1.AuthService, sslCredentials);
    }
    login(request) {
        return this.api.login(request);
    }
    destroy() {
        this.api.end();
    }
}
__decorate([
    (0, retries_1.retryable)()
], StaticCredentialsGrpcService.prototype, "login", null);
class StaticCredentialsAuthService {
    constructor(user, password, endpoint, options) {
        this.tokenRequestTimeout = 10 * 1000;
        this.tokenExpirationTimeout = 6 * 60 * 60 * 1000;
        this.token = '';
        this.tokenUpdatePromise = null;
        this.tokenTimestamp = null;
        this.user = user;
        this.password = password;
        this.endpoint = endpoint;
        this.sslCredentials = options === null || options === void 0 ? void 0 : options.sslCredentials;
        if (options === null || options === void 0 ? void 0 : options.tokenRequestTimeout)
            this.tokenRequestTimeout = options.tokenRequestTimeout;
        if (options === null || options === void 0 ? void 0 : options.tokenExpirationTimeout)
            this.tokenExpirationTimeout = options.tokenExpirationTimeout;
    }
    get expired() {
        return !this.tokenTimestamp || (luxon_1.DateTime.utc().diff(this.tokenTimestamp).valueOf() > this.tokenExpirationTimeout);
    }
    async sendTokenRequest() {
        let runtimeAuthService = new StaticCredentialsGrpcService(this.endpoint, this.sslCredentials);
        const tokenPromise = runtimeAuthService.login({
            user: this.user,
            password: this.password,
        });
        const response = await (0, utils_1.withTimeout)(tokenPromise, this.tokenRequestTimeout);
        const result = AuthServiceResult.decode((0, utils_1.getOperationPayload)(response));
        runtimeAuthService.destroy();
        return result;
    }
    async updateToken() {
        const { token } = await this.sendTokenRequest();
        if (token) {
            this.token = token;
            this.tokenTimestamp = luxon_1.DateTime.utc();
        }
        else {
            throw new Error('Received empty token from static credentials!');
        }
    }
    async getAuthMetadata() {
        if (this.expired || this.tokenUpdatePromise) {
            if (!this.tokenUpdatePromise) {
                this.tokenUpdatePromise = this.updateToken();
            }
            await this.tokenUpdatePromise;
            this.tokenUpdatePromise = null;
        }
        return makeCredentialsMetadata(this.token);
    }
}
exports.StaticCredentialsAuthService = StaticCredentialsAuthService;
class TokenAuthService {
    constructor(token) {
        this.token = token;
    }
    async getAuthMetadata() {
        return makeCredentialsMetadata(this.token);
    }
}
exports.TokenAuthService = TokenAuthService;
class IamTokenGrpcService extends utils_1.GrpcService {
    constructor(iamCredentials, sslCredentials) {
        super(iamCredentials.iamEndpoint, 'yandex.cloud.iam.v1.IamTokenService', IamTokenService, sslCredentials);
    }
    create(request) {
        return this.api.create(request);
    }
    destroy() {
        this.api.end();
    }
}
__decorate([
    (0, retries_1.retryable)()
], IamTokenGrpcService.prototype, "create", null);
class IamAuthService {
    constructor(iamCredentials, sslCredentials) {
        this.jwtExpirationTimeout = 3600 * 1000;
        this.tokenExpirationTimeout = 120 * 1000;
        this.tokenRequestTimeout = 10 * 1000;
        this.token = '';
        this.tokenUpdateInProgress = false;
        this.iamCredentials = iamCredentials;
        this.sslCredentials = sslCredentials || (0, ssl_credentials_1.makeDefaultSslCredentials)();
        this.tokenTimestamp = null;
    }
    getJwtRequest() {
        const now = luxon_1.DateTime.utc();
        const expires = now.plus({ milliseconds: this.jwtExpirationTimeout });
        const payload = {
            "iss": this.iamCredentials.serviceAccountId,
            "aud": "https://iam.api.cloud.yandex.net/iam/v1/tokens",
            "iat": Math.round(now.toSeconds()),
            "exp": Math.round(expires.toSeconds())
        };
        const options = {
            algorithm: "PS256",
            keyid: this.iamCredentials.accessKeyId
        };
        return jsonwebtoken_1.default.sign(payload, this.iamCredentials.privateKey, options);
    }
    get expired() {
        return !this.tokenTimestamp || (luxon_1.DateTime.utc().diff(this.tokenTimestamp).valueOf() > this.tokenExpirationTimeout);
    }
    async sendTokenRequest() {
        let runtimeIamAuthService = new IamTokenGrpcService(this.iamCredentials, this.sslCredentials);
        const tokenPromise = runtimeIamAuthService.create({ jwt: this.getJwtRequest() });
        const result = await (0, utils_1.withTimeout)(tokenPromise, this.tokenRequestTimeout);
        runtimeIamAuthService.destroy();
        return result;
    }
    async updateToken() {
        this.tokenUpdateInProgress = true;
        const { iamToken } = await this.sendTokenRequest();
        if (iamToken) {
            this.token = iamToken;
            this.tokenTimestamp = luxon_1.DateTime.utc();
            this.tokenUpdateInProgress = false;
        }
        else {
            this.tokenUpdateInProgress = false;
            throw new Error('Received empty token from IAM!');
        }
    }
    async waitUntilTokenUpdated() {
        while (this.tokenUpdateInProgress) {
            await (0, utils_1.sleep)(1);
        }
        return;
    }
    async getAuthMetadata() {
        if (this.expired) {
            // block updateToken calls while token updating
            if (this.tokenUpdateInProgress)
                await this.waitUntilTokenUpdated();
            else
                await this.updateToken();
        }
        return makeCredentialsMetadata(this.token);
    }
}
exports.IamAuthService = IamAuthService;
class MetadataAuthService {
    /** Do not use this, use MetadataAuthService.create */
    constructor(tokenService) {
        this.tokenService = tokenService;
    }
    /**
     * Load @yandex-cloud/nodejs-sdk and create `MetadataTokenService` if tokenService is not set
     */
    async createMetadata() {
        if (!this.tokenService) {
            const { MetadataTokenService } = await Promise.resolve().then(() => __importStar(require('@yandex-cloud/nodejs-sdk/dist/token-service/metadata-token-service')));
            this.MetadataTokenServiceClass = MetadataTokenService;
            this.tokenService = new MetadataTokenService();
        }
    }
    async getAuthMetadata() {
        await this.createMetadata();
        if (this.MetadataTokenServiceClass &&
            this.tokenService instanceof this.MetadataTokenServiceClass) {
            const token = await this.tokenService.getToken();
            return makeCredentialsMetadata(token);
        }
        else {
            return this.getAuthMetadataCompat();
        }
    }
    // Compatibility method for working with TokenService defined in yandex-cloud@1.x
    async getAuthMetadataCompat() {
        const MAX_TRIES = 5;
        const tokenService = this.tokenService;
        let token = tokenService.getToken();
        if (!token && typeof tokenService.initialize === 'function') {
            await tokenService.initialize();
            token = tokenService.getToken();
        }
        let tries = 0;
        while (!token && tries < MAX_TRIES) {
            await (0, utils_1.sleep)(2000);
            tries++;
            token = tokenService.getToken();
        }
        if (token) {
            return makeCredentialsMetadata(token);
        }
        throw new Error(`Failed to fetch access token via metadata service in ${MAX_TRIES} tries!`);
    }
}
exports.MetadataAuthService = MetadataAuthService;
