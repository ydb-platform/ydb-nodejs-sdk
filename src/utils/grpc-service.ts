import * as $protobuf from "protobufjs";
import {ServiceFactory} from "./service-factory";
import {ISslCredentials} from "../ssl-credentials";
import {removeProtocol} from "./remove-protocol";
import * as grpc from "@grpc/grpc-js";
import _ from "lodash";

export abstract class GrpcService<Api extends $protobuf.rpc.Service> {
    protected api: Api;

    protected constructor(host: string, private name: string, private apiCtor: ServiceFactory<Api>, sslCredentials?: ISslCredentials) {
        this.api = this.getClient(removeProtocol(host), sslCredentials);
    }

    protected getClient(host: string, sslCredentials?: ISslCredentials): Api {
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
