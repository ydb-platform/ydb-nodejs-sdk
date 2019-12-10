import grpc, {Metadata} from 'grpc';
import * as $protobuf from 'protobufjs';
import _ from 'lodash';
import {Ydb} from '../proto/bundle';

import {IAuthService} from './credentials';
import StatusCode = Ydb.StatusIds.StatusCode;


type ServiceFactory<T> = {
    create(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean): T
};

export interface ISslCredentials {
    rootCertificates?: Buffer,
    clientPrivateKey?: Buffer,
    clientCertChain?: Buffer
}

export abstract class GrpcService<Api extends $protobuf.rpc.Service> {
    protected api: Api;

    protected constructor(host: string, private name: string, private apiCtor: ServiceFactory<Api>, sslCredentials?: ISslCredentials) {
        this.api = this.getClient(host, sslCredentials);
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
            this.getClient(host, this.authService.sslCredentials),
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

class MissingOperation extends Error {}
class MissingValue extends Error {}
class MissingStatus extends Error {}
export class TimeoutExpired extends Error {}

class OperationError extends Error {
    constructor(message: string, public code: StatusCode) {
        super(message);
    }
}

export function getOperationPayload(response: AsyncResponse): Uint8Array {
    const {operation} = response;

    if (operation) {
        const {status} = operation;

        if (!status) {
            throw new MissingStatus('No operation status!');
        } else if (status === Ydb.StatusIds.StatusCode.SUCCESS) {
            if (operation.result) {
                return operation.result.value as Uint8Array;
            } else {
                throw new MissingValue('Missing operation result value!');
            }
        } else {
            const issues = JSON.stringify(operation.issues, null, 2);
            throw new OperationError(`Operation failed with issues ${issues}`, status);
        }
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
