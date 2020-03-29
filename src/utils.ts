import grpc, {Metadata} from 'grpc';
import * as $protobuf from 'protobufjs';
import _ from 'lodash';
import {Ydb} from '../proto/bundle';
import {YdbError, StatusCode} from "./errors";

import {Endpoint} from './discovery';
import {IAuthService} from './credentials';
import {MissingValue, OperationError, MissingOperation} from './errors';


export interface Pessimizable {
    endpoint: Endpoint;
}

type ServiceFactory<T> = {
    create(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean): T
};

export interface ISslCredentials {
    rootCertificates?: Buffer,
    clientPrivateKey?: Buffer,
    clientCertChain?: Buffer
}

function removeProtocol(entryPoint: string) {
    const re = /^(grpc:\/\/|grpcs:\/\/)?(.+)/;
    const match = re.exec(entryPoint) as string[];
    return match[2];
}

export abstract class GrpcService<Api extends $protobuf.rpc.Service> {
    protected api: Api;

    protected constructor(host: string, private name: string, private apiCtor: ServiceFactory<Api>, sslCredentials?: ISslCredentials) {
        this.api = this.getClient(removeProtocol(host), sslCredentials);
    }

    protected getClient(host: string, sslCredentials?: ISslCredentials): Api {
        const client = sslCredentials ?
            new grpc.Client(host, grpc.credentials.createSsl()) :
            new grpc.Client(host, grpc.credentials.createInsecure());
        const rpcImpl: $protobuf.RPCImpl = (method, requestData, callback) => {
            const path = `/${this.name}/${method.name}`;
            client.makeUnaryRequest(path, _.identity, _.identity, requestData, null, null, callback);
        };
        return this.apiCtor.create(rpcImpl);
    }
}

export abstract class BaseService<Api extends $protobuf.rpc.Service> {
    protected api: Api;
    private metadata: Metadata | null = null;

    static isServiceAsyncMethod(target: object, prop: string|number|symbol, receiver: any) {
        return (
            Reflect.has(target, prop) &&
            typeof Reflect.get(target, prop, receiver) === 'function' &&
            prop !== 'create'
        );
    }

    protected constructor(
        host: string,
        private name: string,
        private apiCtor: ServiceFactory<Api>,
        private authService: IAuthService
    ) {
        this.api = new Proxy(
            this.getClient(removeProtocol(host), this.authService.sslCredentials),
            {
                get: (target, prop, receiver) => {
                    const property = Reflect.get(target, prop, receiver);
                    return BaseService.isServiceAsyncMethod(target, prop, receiver) ?
                        async (...args: any[]) => {
                            this.metadata = await this.authService.getAuthMetadata();
                            return property.call(target, ...args);
                        } :
                        property;
                }
            }
        );
    }

    protected getClient(host: string, sslCredentials?: ISslCredentials): Api {
        const client = sslCredentials ?
            new grpc.Client(host, grpc.credentials.createSsl(sslCredentials.rootCertificates)) :
            new grpc.Client(host, grpc.credentials.createInsecure());
        const rpcImpl: $protobuf.RPCImpl = (method, requestData, callback) => {
            const path = `/${this.name}/${method.name}`;
            client.makeUnaryRequest(path, _.identity, _.identity, requestData, this.metadata, null, callback);
        };
        return this.apiCtor.create(rpcImpl);
    }
}

interface AsyncResponse {
    operation?: Ydb.Operations.IOperation | null
}

export function getOperationPayload(response: AsyncResponse): Uint8Array {
    const {operation} = response;

    if (operation) {
        YdbError.checkStatus(operation);
        const value = operation?.result?.value;
        if (!value) {
            throw new MissingValue('Missing operation result value!');
        }
        return value;
    } else {
        throw new MissingOperation('No operation in response!');
    }
}

export function ensureOperationSucceeded(response: AsyncResponse, suppressedErrors: StatusCode[] = []): void {
    try {
        getOperationPayload(response);
    } catch (e) {
        if (e instanceof OperationError) {
            if (suppressedErrors.indexOf(e.code) > -1) {
                return;
            }
        }

        if (!(e instanceof MissingValue)) {
            throw e;
        }
    }
}

export function pessimizable(_target: Pessimizable, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (this: Pessimizable, ...args: any) {
        try {
            return await originalMethod.call(this, ...args);
        } catch (error) {
            if (error instanceof OperationError) {
                this.endpoint.pessimize();
            }
            throw error;
        }
    };
    return descriptor;
}
