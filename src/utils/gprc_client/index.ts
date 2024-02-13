// same options as for table client, incluiding log
// header + auth metadata
// prefix
// paramters - method, args, res
// output stream
// connected to endpoint

import {IAuthService} from "../../credentials";
import {Logger} from "../../logging";
import {ISslCredentials} from "../../ssl-credentials";
import {ClientOptions} from "../client-options";
import * as grpc from "@grpc/grpc-js";
import {removeProtocol} from "../remove-protocol";
import pkgInfo from "../../../package.json";
import {BufferWriter, Writer} from "protobufjs";

const SDK_VERSION_HDR = 'x-ydb-sdk-build-info';
const SDK_VERSION = `ydb-nodejs-sdk/${pkgInfo.version}`;

const DB_HDR = 'x-ydb-database';

const enum GRPC_NS {
    TableV1 = 'Ydb.Table.V1.TableService',
    QueryV1 = 'Ydb.Query.V1.QueryService',
}

export class GrpcClient {
    // @ts-ignore
    private logger: Logger;
    private endpoint: string;
    private client: grpc.Client;
    private database: string;
    private authService: IAuthService;
    private sslCredentials?: ISslCredentials;
    private clientOptions?: ClientOptions;

    constructor(opts: {
        logger: Logger,
        // TODO: consider named args
        host: string,
        endpoint: string,
        database: string,
        authService: IAuthService,
        sslCredentials?: ISslCredentials,
        clientOptions?: ClientOptions
    }) {
        this.logger = opts.logger;

        if (!(opts.host || opts.endpoint)) throw new Error('Either "host" or "endpoint" must be specified');
        this.endpoint = opts.host ? removeProtocol(opts.host) : opts.endpoint.toString();

        this.database = opts.database;
        this.authService = opts.authService;
        if (opts.sslCredentials) this.sslCredentials = opts.sslCredentials;
        if (opts.clientOptions) this.clientOptions = opts.clientOptions;

        this.client = this.sslCredentials ?
            new grpc.Client(
                this.endpoint,
                grpc.credentials.createSsl(
                    this.sslCredentials.rootCertificates,
                    this.sslCredentials.clientCertChain,
                    this.sslCredentials.clientPrivateKey),
                this.clientOptions) :
            new grpc.Client(
                this.endpoint,
                grpc.credentials.createInsecure(),
                this.clientOptions);
    }

    async destroy() {
        // not init
    }

    async call<
        IReq extends { encode: (value: IReq) => BufferWriter | Writer },
        IResp extends { decode: (value: Buffer) => IResp }
    >(
        namespace: GRPC_NS,
        grpcMethod: {
            (request: IReq): IResp;
            name: string;
        },
        reqCtor: IReq,
        respCtor: IResp,
        request: IReq) { // {metadata. response}

        const reqMetadata = new grpc.Metadata();
        reqMetadata.add(SDK_VERSION_HDR, SDK_VERSION);
        reqMetadata.add(DB_HDR, this.database);
        for (const [key, value] of Object.entries(await this.authService.getAuthMetadata())) {
            reqMetadata.add(key, value);
        }

        let respMetadata: grpc.Metadata | undefined;
        let response = await new Promise<IResp>((resolve, reject) => {
            const events = this.client.makeUnaryRequest(
                `/${namespace}/${grpcMethod.name}`,
                (req: IReq) => reqCtor.encode(req).finish() as Buffer,
                respCtor.decode,
                request,
                reqMetadata,
                (err, resp) => {
                    console.info(3200, err, resp);
                    if (err) reject(err);
                    resolve(resp!);
                });
            events.on('status', ({metadata}) => {
                respMetadata = metadata;
            });
        });
        return {metadata: respMetadata, response};
    };

    // callStreamOut(method, request); // event emitter
    //
    // streamInResponse(method); // {writer, async getResult()}
    //
    // streamInStreamOut(method); // {writer, event emitter}
}
