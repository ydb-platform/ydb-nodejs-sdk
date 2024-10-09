import {DateTime} from "luxon";
import {Ydb} from "ydb-sdk-proto";
import IEndpointInfo = Ydb.Discovery.IEndpointInfo;
import * as grpc from "@grpc/grpc-js";
import {ISslCredentials} from "../utils/ssl-credentials";
import {ClientOptions} from "../utils";
import {InternalTopicClient} from "../topic/internal/internal-topic-client";

export type SuccessDiscoveryHandler = (result: Endpoint[]) => void;


// TODO: Keep node ID
// TODO: Keep lazy GRPC connection
// TODO: ? drop grpc connection on end
export class Endpoint extends Ydb.Discovery.EndpointInfo {
    static HOST_RE = /^([^:]+):?(\d)*$/;
    static PESSIMIZATION_WEAR_OFF_PERIOD = 60 * 1000; //  TODO: wher off once new list of nodes was received

    private pessimizedAt: DateTime | null;

    public topicNodeClient?: InternalTopicClient;

    static fromString(host: string) {
        const match = Endpoint.HOST_RE.exec(host);
        if (match) {
            const info: Ydb.Discovery.IEndpointInfo = {
                address: match[1]
            };
            if (match[2]) {
                info.port = Number(match[2]);
            }
            return this.create(info);
        }
        throw new Error(`Provided incorrect host "${host}"`);
    }

    constructor(properties: IEndpointInfo, public readonly database: string) {
        super(properties);
        this.pessimizedAt = null;
    }

    /*
     Update current endpoint with the attributes taken from another endpoint.
     */
    public update(_endpoint: Endpoint) {
        // do nothing for now
        return this;
    }

    public get pessimized(): boolean { // TODO: Depessimize on next endpoint update
        if (this.pessimizedAt) {
            return DateTime.utc().diff(this.pessimizedAt).valueOf() < Endpoint.PESSIMIZATION_WEAR_OFF_PERIOD;
        }
        return false;
    }

    public pessimize() {
        this.pessimizedAt = DateTime.utc();
    }

    public toString(): string {
        // TODO: Find out how to specify a host ip/name for local development
        if (process.env.YDB_ENDPOINT) {
            const str = process.env.YDB_ENDPOINT;
            const n = str.indexOf('://'); // remove grpc(s)?://
            return n > 0 ? str.substr(n + 3) : str;
        } // for development only
        let result = this.address;
        if (this.port) {
            result += ':' + this.port;
        }
        return result;
    }

    private grpcClient?: grpc.Client;

    // TODO: Close the client if it was not used for a time
    public getGrpcClient(sslCredentials?: ISslCredentials, clientOptions?: ClientOptions) {
        if (!this.grpcClient) {
            this.grpcClient = sslCredentials ?
                new grpc.Client(this.toString(), grpc.credentials.createSsl(sslCredentials.rootCertificates, sslCredentials.clientCertChain, sslCredentials.clientPrivateKey), clientOptions) :
                new grpc.Client(this.toString(), grpc.credentials.createInsecure(), clientOptions);
        }
        return this.grpcClient;
    }

    public closeGrpcClient() {
        if (this.grpcClient) {
            this.grpcClient.close();
            delete this.grpcClient;
        }
    }
}
