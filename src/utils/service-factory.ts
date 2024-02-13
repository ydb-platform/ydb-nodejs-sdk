import * as $protobuf from "protobufjs";

export type ServiceFactory<T> = {
    create(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean): T
};
