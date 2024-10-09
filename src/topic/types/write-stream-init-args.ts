import Long from "long";
import {Ydb} from "ydb-sdk-proto";

export interface WriteStreamInitArgs {
    path: (string|null);
    producerId?: (string|null);
    writeSessionMeta?: ({ [k: string]: string }|null);
    messageGroupId?: (string|null);
    partitionId?: (number|Long|null);
    getLastSeqNo?: (boolean|null);
}

export interface WriteStreamWriteArgs {
    readonly lastSeqNo?: (number|Long|null);
    readonly sessionId?: (string|null);
    readonly partitionId?: (number|Long|null);
    readonly supportedCodecs?: (Ydb.Topic.ISupportedCodecs|null);
}

export interface WriteStreamWriteArgs {
    messages: (Ydb.Topic.StreamWriteMessage.WriteRequest.IMessageData[]|null);
    codec?: (number|null);
    tx?: (Ydb.Topic.ITransactionIdentity|null);
}

export interface WriteStreamWriteResult {
    readonly acks?: (Ydb.Topic.StreamWriteMessage.WriteResponse.IWriteAck[]|null);
    readonly partitionId?: (number|Long|null);
    readonly writeStatistics?: (Ydb.Topic.StreamWriteMessage.WriteResponse.IWriteStatistics|null);
}

export interface A {

}

export interface A {

}

export interface A {

}

export interface A {

}

export interface A {

}

export interface A {

}

export interface A {

}

export interface A {

}
