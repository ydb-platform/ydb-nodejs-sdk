// eslint-disable-next-line max-classes-per-file
import * as grpc from '@grpc/grpc-js';
// TODO: Later check linter message below
// eslint-disable-next-line import/no-extraneous-dependencies
import * as $protobuf from 'protobufjs';
import _ from 'lodash';
import { TimeoutExpired } from '../errors';

import { Endpoint } from '../discovery';
import { IAuthService } from '../credentials';
import { getVersionHeader } from '../version';
import { ISslCredentials } from '../ssl-credentials';

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
    const timedRejection: Promise<never> = new Promise((__, reject) => {
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
            ? new grpc.Client(host, grpc.credentials.createSsl(
                sslCredentials.rootCertificates,
                sslCredentials.clientPrivateKey,
                sslCredentials.clientCertChain,
            ))
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ClientOptions = Record<string, any>;

export abstract class AuthenticatedService<Api extends $protobuf.rpc.Service> {
    protected api: Api;
    private metadata: grpc.Metadata;
    private responseMetadata: WeakMap<object, grpc.Metadata>;
    private lastRequest!: object;

    private readonly headers: MetadataHeaders;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ? async (...args: any[]) => {
                            if (!['emit', 'rpcCall', 'rpcImpl'].includes(String(prop)) && args.length > 0) {
                                // eslint-disable-next-line prefer-destructuring
                                this.lastRequest = args[0];
                            }

                            this.metadata = await this.authService.getAuthMetadata();
                            for (const [key, value] of this.headers) {
                                if (value) {
                                    this.metadata.add(key, value);
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
            ? new grpc.Client(
                host,
                grpc.credentials.createSsl(
                    sslCredentials.rootCertificates,
                    sslCredentials.clientCertChain,
                    sslCredentials.clientPrivateKey,
                ),
                clientOptions,
            )
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
