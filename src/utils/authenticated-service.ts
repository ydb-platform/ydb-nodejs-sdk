import * as $protobuf from "protobufjs";
import * as grpc from "@grpc/grpc-js";
import {ISslCredentials} from "./ssl-credentials";
import {getVersionHeader} from "../version";
import _ from "lodash";
import {IAuthService} from "../credentials/i-auth-service";

function getDatabaseHeader(database: string): [string, string] {
    return ['x-ydb-database', database];
}

type ServiceFactory<T> = {
    create(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean): T
};

function removeProtocol(endpoint: string) {
    return endpoint.replace(/^(grpcs?|https?):\/\//, '');;
}

export class StreamEnd extends Error {
}

export abstract class GrpcService<Api extends $protobuf.rpc.Service> {
    protected api: Api;

    protected constructor(host: string, private name: string, private apiCtor: ServiceFactory<Api>, sslCredentials?: ISslCredentials) {
        this.api = this.getClient(removeProtocol(host), sslCredentials);
    }

    protected getClient(host: string, sslCredentials?: ISslCredentials): Api {
        // TODO: Change to one grpc connect all services per endpoint.  Ensure that improves SLO
        const client = sslCredentials ?
            new grpc.Client(host, grpc.credentials.createSsl(sslCredentials.rootCertificates, sslCredentials.clientPrivateKey, sslCredentials.clientCertChain)) :
            new grpc.Client(host, grpc.credentials.createInsecure());
        const rpcImpl: $protobuf.RPCImpl = (method, requestData, callback) => {
            if (null === method && requestData === null && callback === null) {
                // signal `end` from protobuf service
                client.close()
                return
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
    public metadata: grpc.Metadata;
    private responseMetadata: WeakMap<object, grpc.Metadata>;
    private lastRequest!: object;
    private readonly headers: MetadataHeaders;
    // TODO: Take from endpoint and from createSession response
    public grpcServiceClient?: grpc.Client;

    static isServiceAsyncMethod(target: object, prop: string | number | symbol, receiver: any) {
        return (
            Reflect.has(target, prop) &&
            typeof Reflect.get(target, prop, receiver) === 'function' &&
            prop !== 'create'
        );
    }

    public getResponseMetadata(request: object) {
        return this.responseMetadata.get(request);
    }

    protected constructor(
        hostOrGrpcClient: string | grpc.Client,
        database: string,
        private name: string,
        private apiCtor: ServiceFactory<Api>,
        protected authService: IAuthService,
        protected sslCredentials?: ISslCredentials,
        protected clientOptions?: ClientOptions,
    ) {
        this.headers = new Map([getVersionHeader(), getDatabaseHeader(database)]);
        this.metadata = new grpc.Metadata();
        this.responseMetadata = new WeakMap();
        this.api = new Proxy(
            this.getClient(typeof hostOrGrpcClient === 'string' ? removeProtocol(hostOrGrpcClient) : hostOrGrpcClient, this.sslCredentials, clientOptions),
            {
                get: (target, prop, receiver) => {
                    const property = Reflect.get(target, prop, receiver);
                    return AuthenticatedService.isServiceAsyncMethod(target, prop, receiver) ?
                        async (...args: any[]) => {
                            if (!['emit', 'rpcCall', 'rpcImpl'].includes(String(prop))) {
                                if (args.length) {
                                    this.lastRequest = args[0];
                                }
                            }

                            await this.updateMetadata();

                            return (property as Function).call(receiver, ...args);
                        } :
                        property;
                }
            }
        );
    }

    public async updateMetadata() {
        this.metadata = await this.authService.getAuthMetadata();
        for (const [name, value] of this.headers) {
            if (value) {
                this.metadata.add(name, value);
            }
        }
    }

    protected getClient(hostOrGrpcClient: string | grpc.Client, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions): Api {
        const client = this.grpcServiceClient =
            typeof hostOrGrpcClient !== 'string'
                ? hostOrGrpcClient
                : sslCredentials
                    ? new grpc.Client(hostOrGrpcClient, grpc.credentials.createSsl(sslCredentials.rootCertificates, sslCredentials.clientCertChain, sslCredentials.clientPrivateKey), clientOptions)
                    : new grpc.Client(hostOrGrpcClient, grpc.credentials.createInsecure(), clientOptions);
        const rpcImpl: $protobuf.RPCImpl = (method, requestData, callback) => {
            const path = `/${this.name}/${method.name}`;
            if (method.name.startsWith('Stream')) {
                client.makeServerStreamRequest(path, _.identity, _.identity, requestData, this.metadata)
                    .on('data', (data) => callback(null, data))
                    .on('end', () => callback(new StreamEnd(), null))
                    .on('error', (error) => callback(error, null));
            } else {
                const req = client.makeUnaryRequest(path, _.identity, _.identity, requestData, this.metadata, callback);
                const lastRequest = this.lastRequest;
                req.on('status', ({metadata}: grpc.StatusObject) => {
                    if (lastRequest) {
                        this.responseMetadata.set(lastRequest, metadata);
                    }
                });
            }
        };
        return this.apiCtor.create(rpcImpl);
    }
}
