import {Logger} from "../logger/simple-logger";
import {Ydb} from "ydb-sdk-proto";
import {InternalTopicService} from "./internal-topic-service";
import StreamWriteMessage = Ydb.Topic.StreamWriteMessage;
import {ClientWritableStream, ServiceError} from "@grpc/grpc-js/src/call";

export interface InternalTopicWriteOpts {
}

export class InternalTopicWrite {
    // @ts-ignore
    private writeStream: ClientWritableStream<StreamWriteMessage.FromClient>;

    constructor(
        private topicService: InternalTopicService,
        // @ts-ignore
        private logger: Logger,
        // @ts-ignore
        private opts: InternalTopicWriteOpts) {
        this.writeStream = this.topicService.grpcClient!
            .makeClientStreamRequest(
                '/Ydb.Topic.V1.TopicService/StreamWrite',
                (v: StreamWriteMessage.FromClient) => StreamWriteMessage.FromServer.encode(v).finish() as Buffer,
                StreamWriteMessage.FromServer.decode,
                this.topicService.metadata,
                (err: ServiceError | null, value?: StreamWriteMessage.FromServer) => {
                    // TODO: process
                }
            )
    }

    // TODO: Regular update token
}
