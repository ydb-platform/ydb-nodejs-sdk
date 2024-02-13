import * as $protobuf from "protobufjs";
import {ISslCredentials} from "../ssl-credentials";
import * as grpc from "@grpc/grpc-js";
import _ from "lodash";
import {IAuthService} from "../credentials";
import {getVersionHeader} from "../version";
import {StreamEnd} from "../table/utils";
import {ClientOptions, getDatabaseHeader, MetadataHeaders, removeProtocol, ServiceFactory} from "../utils";
import {TableAuthenticatedService} from "../table/table-authenticated-service";

export abstract class QueryAuthenticatedService<Api extends $protobuf.rpc.Service> {
    protected api: Api; // TODO: Consider remove
    protected metadata: grpc.Metadata;
    private responseMetadata: WeakMap<object, grpc.Metadata>;
    private lastRequest!: object;

    protected readonly headers: MetadataHeaders;

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

    /**
     *
     * @param host
     * @param database
     * @param name
     * @param apiCtor
     * @param authService
     * @param sslCredentials
     * @param clientOptions
     * @param streamMethods In query service API unlike table service API methods that return stream
     *                     are not labeled with the word Stream in the name.  So they must be listed explicitly
     * @protected
     */
    protected constructor(
        host: string,
        database: string,
        private name: string,
        private apiCtor: ServiceFactory<Api>,
        protected authService: IAuthService,
        protected sslCredentials?: ISslCredentials,
        protected clientOptions?: ClientOptions,
        private streamMethods?: string[],
    ) {
        this.headers = new Map([getVersionHeader(), getDatabaseHeader(database)]);
        this.metadata = new grpc.Metadata();
        this.responseMetadata = new WeakMap();
        this.api = new Proxy(
            this.getClient(removeProtocol(host), this.sslCredentials, clientOptions),
            {
                get: (target, prop, receiver) => {
                    const property = Reflect.get(target, prop, receiver);
                    return TableAuthenticatedService.isServiceAsyncMethod(target, prop, receiver) ?
                        async (...args: any[]) => {
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
            }
        );
    }

    protected getClient(host: string, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions): Api {
        const client = sslCredentials ?
            new grpc.Client(host, grpc.credentials.createSsl(sslCredentials.rootCertificates, sslCredentials.clientCertChain, sslCredentials.clientPrivateKey), clientOptions) :
            new grpc.Client(host, grpc.credentials.createInsecure(), clientOptions);
        const rpcImpl: $protobuf.RPCImpl = (method, requestData, callback) => {
            const path = `/${this.name}/${method.name}`;
            if (method.name.startsWith('Stream') || this.streamMethods?.findIndex((v) => v === method.name)) {
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
