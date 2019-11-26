import grpc, {Metadata} from 'grpc';
import * as $protobuf from 'protobufjs';
import _ from 'lodash';
import {Ydb} from '../proto/bundle';

import {IAuthService} from './credentials';


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
                            return property(...args);
                        } :
                        property;
                }
            }
        );
    }

    static isServiceAsyncMethod(target: object, prop: string|number|symbol, receiver: any) {
        return (
            Reflect.has(target, prop) &&
            typeof Reflect.get(target, prop, receiver) === 'function' &&
            prop !== 'create'
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
    if (response.operation) {
        if (response.operation.status === Ydb.StatusIds.StatusCode.SUCCESS) {
            if (response.operation.result) {
                return response.operation.result.value as Uint8Array;
            } else {
                throw new Error('Missing operation result value!');
            }
        } else {
            const issues = JSON.stringify(response.operation.issues, null, 2);
            throw new Error(`Operation failed with issues ${issues}`);
        }
    } else {
        throw new Error('No operation in response!');
    }
}
