// eslint-disable-next-line max-classes-per-file
import * as grpc from '@grpc/grpc-js';
import * as $protobuf from 'protobufjs';
import _ from 'lodash';
import { Ydb } from 'ydb-sdk-proto';
import Long from 'long';
import {
    MissingOperation, MissingValue, NotFound, StatusCode, TimeoutExpired, YdbError,
} from './errors';

import { Endpoint } from './discovery';
import { IAuthService } from './credentials';
import { getVersionHeader } from './version';
import { ISslCredentials } from './ssl-credentials';

const getDatabaseHeader = (database: string): [string, string] => ['x-ydb-database', database];

export interface Pessimizable {
    endpoint: Endpoint;
}

type ServiceFactory<T> = {
    create(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean): T
};

const removeProtocol = (endpoint: string) => {
    const re = /^(grpc:\/\/|grpcs:\/\/)?(.+)/;
    const match = re.exec(endpoint) as string[];

    return match[2];
};

export const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    let timeoutId: NodeJS.Timeout;
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const timedRejection: Promise<never> = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new TimeoutExpired(`Timeout of ${timeoutMs}ms has expired`));
        }, timeoutMs);
    });

    return Promise.race([promise.finally(() => {
        clearTimeout(timeoutId);
    }), timedRejection]);
};

export class StreamEnd extends Error {}

export abstract class GrpcService<Api extends $protobuf.rpc.Service> {
    protected api: Api;

    protected constructor(host: string, private name: string, private apiCtor: ServiceFactory<Api>, sslCredentials?: ISslCredentials) {
        this.api = this.getClient(removeProtocol(host), sslCredentials);
    }

    protected getClient(host: string, sslCredentials?: ISslCredentials): Api {
        const client = sslCredentials
            // eslint-disable-next-line max-len
            ? new grpc.Client(host, grpc.credentials.createSsl(sslCredentials.rootCertificates, sslCredentials.clientPrivateKey, sslCredentials.clientCertChain))
            : new grpc.Client(host, grpc.credentials.createInsecure());
        const rpcImpl: $protobuf.RPCImpl = (method, requestData, callback) => {
            if (method === null && requestData === null && callback === null) {
                // signal `end` from protobuf service
                client.close();

                return;
            }
            const path = `/${this.name}/${method.name}`;

            client.makeUnaryRequest(path, _.identity, _.identity, requestData, callback);
        };

        return this.apiCtor.create(rpcImpl);
    }
}

export type MetadataHeaders = Map<string, string>;
export type ClientOptions = Record<string, any>;

export abstract class AuthenticatedService<Api extends $protobuf.rpc.Service> {
    protected api: Api;
    private metadata: grpc.Metadata;
    private responseMetadata: WeakMap<object, grpc.Metadata>;
    private lastRequest!: object;

    private readonly headers: MetadataHeaders;

    static isServiceAsyncMethod(target: object, prop: string | number | symbol, receiver: any) {
        return (
            Reflect.has(target, prop)
            && typeof Reflect.get(target, prop, receiver) === 'function'
            && prop !== 'create'
        );
    }

    public getResponseMetadata(request: object) {
        return this.responseMetadata.get(request);
    }

    protected constructor(
        host: string,
        database: string,
        private name: string,
        private apiCtor: ServiceFactory<Api>,
        private authService: IAuthService,
        private sslCredentials?: ISslCredentials,
        clientOptions?: ClientOptions,
    ) {
        this.headers = new Map([getVersionHeader(), getDatabaseHeader(database)]);
        this.metadata = new grpc.Metadata();
        this.responseMetadata = new WeakMap();
        this.api = new Proxy(
            this.getClient(removeProtocol(host), this.sslCredentials, clientOptions),
            {
                get: (target, prop, receiver) => {
                    const property = Reflect.get(target, prop, receiver);

                    return AuthenticatedService.isServiceAsyncMethod(target, prop, receiver)
                        ? async (...args: any[]) => {
                            if (!['emit', 'rpcCall', 'rpcImpl'].includes(String(prop)) && args.length > 0) {
                                // eslint-disable-next-line prefer-destructuring
                                this.lastRequest = args[0];
                            }

                            this.metadata = await this.authService.getAuthMetadata();
                            // eslint-disable-next-line @typescript-eslint/no-shadow
                            for (const [name, value] of this.headers) {
                                if (value) {
                                    this.metadata.add(name, value);
                                }
                            }

                            return property.call(receiver, ...args);
                        }
                        : property;
                },
            },
        );
    }

    protected getClient(host: string, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions): Api {
        const client = sslCredentials
            // eslint-disable-next-line max-len
            ? new grpc.Client(host, grpc.credentials.createSsl(sslCredentials.rootCertificates, sslCredentials.clientCertChain, sslCredentials.clientPrivateKey), clientOptions)
            : new grpc.Client(host, grpc.credentials.createInsecure(), clientOptions);
        const rpcImpl: $protobuf.RPCImpl = (method, requestData, callback) => {
            const path = `/${this.name}/${method.name}`;

            if (method.name.startsWith('Stream')) {
                client.makeServerStreamRequest(path, _.identity, _.identity, requestData, this.metadata)
                    .on('data', (data) => callback(null, data))
                    .on('end', () => callback(new StreamEnd(), null))
                    .on('error', (error) => callback(error, null));
            } else {
                const req = client.makeUnaryRequest(path, _.identity, _.identity, requestData, this.metadata, callback);
                const { lastRequest } = this;

                req.on('status', ({ metadata }: grpc.StatusObject) => {
                    if (lastRequest) {
                        // eslint-disable-next-line unicorn/consistent-destructuring
                        this.responseMetadata.set(lastRequest, metadata);
                    }
                });
            }
        };

        return this.apiCtor.create(rpcImpl);
    }
}

export interface AsyncResponse {
    operation?: Ydb.Operations.IOperation | null
}

export const getOperationPayload = (response: AsyncResponse): Uint8Array => {
    const { operation } = response;

    if (operation) {
        YdbError.checkStatus(operation);
        const value = operation?.result?.value;

        if (!value) {
            throw new MissingValue('Missing operation result value!');
        }

        return value;
    }
    throw new MissingOperation('No operation in response!');
};

export const ensureOperationSucceeded = (response: AsyncResponse, suppressedErrors: StatusCode[] = []): void => {
    try {
        getOperationPayload(response);
    } catch (error) {
        const e = error as any;

        if (suppressedErrors.includes(e.constructor.status)) {
            return;
        }

        if (!(e instanceof MissingValue)) {
            throw e;
        }
    }
};

export function pessimizable(_target: Pessimizable, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    // eslint-disable-next-line no-param-reassign
    descriptor.value = function (this: Pessimizable, ...args: any) {
        try {
            return originalMethod.call(this, ...args);
        } catch (error) {
            if (!(error instanceof NotFound)) {
                this.endpoint.pessimize();
            }
            throw error;
        }
    };

    return descriptor;
}

export const sleep = async (milliseconds: number) => {
    await new Promise((resolve) => { setTimeout(resolve, milliseconds); });
};

export const toLong = (value: Long | number): Long => {
    if (typeof value === 'number') {
        return Long.fromNumber(value);
    }

    return value;
};
