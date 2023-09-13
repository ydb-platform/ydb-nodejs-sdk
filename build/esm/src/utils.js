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
exports.toLong = exports.sleep = exports.pessimizable = exports.ensureOperationSucceeded = exports.getOperationPayload = exports.AuthenticatedService = exports.GrpcService = exports.StreamEnd = exports.withTimeout = void 0;
const grpc = __importStar(require("@grpc/grpc-js"));
const lodash_1 = __importDefault(require("lodash"));
const long_1 = __importDefault(require("long"));
const errors_1 = require("./errors");
const version_1 = require("./version");
function getDatabaseHeader(database) {
    return ['x-ydb-database', database];
}
function removeProtocol(endpoint) {
    const re = /^(grpc:\/\/|grpcs:\/\/)?(.+)/;
    const match = re.exec(endpoint);
    return match[2];
}
function withTimeout(promise, timeoutMs) {
    let timeoutId;
    const timedRejection = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new errors_1.TimeoutExpired(`Timeout of ${timeoutMs}ms has expired`));
        }, timeoutMs);
    });
    return Promise.race([promise.finally(() => {
            clearTimeout(timeoutId);
        }), timedRejection]);
}
exports.withTimeout = withTimeout;
class StreamEnd extends Error {
}
exports.StreamEnd = StreamEnd;
class GrpcService {
    name;
    apiCtor;
    api;
    constructor(host, name, apiCtor, sslCredentials) {
        this.name = name;
        this.apiCtor = apiCtor;
        this.api = this.getClient(removeProtocol(host), sslCredentials);
    }
    getClient(host, sslCredentials) {
        const client = sslCredentials ?
            new grpc.Client(host, grpc.credentials.createSsl(sslCredentials.rootCertificates, sslCredentials.clientPrivateKey, sslCredentials.clientCertChain)) :
            new grpc.Client(host, grpc.credentials.createInsecure());
        const rpcImpl = (method, requestData, callback) => {
            if (null === method && requestData === null && callback === null) {
                // signal `end` from protobuf service
                client.close();
                return;
            }
            const path = `/${this.name}/${method.name}`;
            client.makeUnaryRequest(path, lodash_1.default.identity, lodash_1.default.identity, requestData, callback);
        };
        return this.apiCtor.create(rpcImpl);
    }
}
exports.GrpcService = GrpcService;
class AuthenticatedService {
    name;
    apiCtor;
    authService;
    sslCredentials;
    api;
    metadata;
    responseMetadata;
    lastRequest;
    headers;
    static isServiceAsyncMethod(target, prop, receiver) {
        return (Reflect.has(target, prop) &&
            typeof Reflect.get(target, prop, receiver) === 'function' &&
            prop !== 'create');
    }
    getResponseMetadata(request) {
        return this.responseMetadata.get(request);
    }
    constructor(host, database, name, apiCtor, authService, sslCredentials, clientOptions) {
        this.name = name;
        this.apiCtor = apiCtor;
        this.authService = authService;
        this.sslCredentials = sslCredentials;
        this.headers = new Map([(0, version_1.getVersionHeader)(), getDatabaseHeader(database)]);
        this.metadata = new grpc.Metadata();
        this.responseMetadata = new WeakMap();
        this.api = new Proxy(this.getClient(removeProtocol(host), this.sslCredentials, clientOptions), {
            get: (target, prop, receiver) => {
                const property = Reflect.get(target, prop, receiver);
                return AuthenticatedService.isServiceAsyncMethod(target, prop, receiver) ?
                    async (...args) => {
                        if (!['emit', 'rpcCall', 'rpcImpl'].includes(String(prop))) {
                            if (args.length) {
                                this.lastRequest = args[0];
                            }
                        }
                        this.metadata = await this.authService.getAuthMetadata();
                        for (const [name, value] of this.headers) {
                            if (value) {
                                this.metadata.add(name, value);
                            }
                        }
                        return property.call(receiver, ...args);
                    } :
                    property;
            }
        });
    }
    getClient(host, sslCredentials, clientOptions) {
        const client = sslCredentials ?
            new grpc.Client(host, grpc.credentials.createSsl(sslCredentials.rootCertificates, sslCredentials.clientCertChain, sslCredentials.clientPrivateKey), clientOptions) :
            new grpc.Client(host, grpc.credentials.createInsecure(), clientOptions);
        const rpcImpl = (method, requestData, callback) => {
            const path = `/${this.name}/${method.name}`;
            if (method.name.startsWith('Stream')) {
                client.makeServerStreamRequest(path, lodash_1.default.identity, lodash_1.default.identity, requestData, this.metadata)
                    .on('data', (data) => callback(null, data))
                    .on('end', () => callback(new StreamEnd(), null))
                    .on('error', (error) => callback(error, null));
            }
            else {
                const req = client.makeUnaryRequest(path, lodash_1.default.identity, lodash_1.default.identity, requestData, this.metadata, callback);
                const lastRequest = this.lastRequest;
                req.on('status', ({ metadata }) => {
                    if (lastRequest) {
                        this.responseMetadata.set(lastRequest, metadata);
                    }
                });
            }
        };
        return this.apiCtor.create(rpcImpl);
    }
}
exports.AuthenticatedService = AuthenticatedService;
function getOperationPayload(response) {
    const { operation } = response;
    if (operation) {
        errors_1.YdbError.checkStatus(operation);
        const value = operation?.result?.value;
        if (!value) {
            throw new errors_1.MissingValue('Missing operation result value!');
        }
        return value;
    }
    else {
        throw new errors_1.MissingOperation('No operation in response!');
    }
}
exports.getOperationPayload = getOperationPayload;
function ensureOperationSucceeded(response, suppressedErrors = []) {
    try {
        getOperationPayload(response);
    }
    catch (error) {
        const e = error;
        if (suppressedErrors.indexOf(e.constructor.status) > -1) {
            return;
        }
        if (!(e instanceof errors_1.MissingValue)) {
            throw e;
        }
    }
}
exports.ensureOperationSucceeded = ensureOperationSucceeded;
function pessimizable(_target, _propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args) {
        try {
            return await originalMethod.call(this, ...args);
        }
        catch (error) {
            if (!(error instanceof errors_1.NotFound)) {
                this.endpoint.pessimize();
            }
            throw error;
        }
    };
    return descriptor;
}
exports.pessimizable = pessimizable;
async function sleep(milliseconds) {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
exports.sleep = sleep;
function toLong(value) {
    if (typeof value === 'number') {
        return long_1.default.fromNumber(value);
    }
    return value;
}
exports.toLong = toLong;
