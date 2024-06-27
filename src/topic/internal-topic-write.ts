import {Logger} from "../logger/simple-logger";
import {Ydb} from "ydb-sdk-proto";
import {InternalTopicService} from "./internal-topic-service";
import FromClient = Ydb.Topic.StreamWriteMessage.FromClient;
import FromServer = Ydb.Topic.StreamWriteMessage.FromServer;
import {ClientWritableStream/*, ServiceError*/} from "@grpc/grpc-js/build/src/call";
import EventEmitter from "events";

export interface InternalTopicWriteOpts {
}

type InitArgs =
    Ydb.Topic.StreamWriteMessage.IInitRequest
    & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;

type WriteArgs =
    Ydb.Topic.StreamWriteMessage.IWriteRequest
    & Required<Pick<Ydb.Topic.StreamWriteMessage.IWriteRequest, 'messages'>>;

type UpdateTokenArgs = Ydb.Topic.UpdateTokenRequest & Required<Pick<Ydb.Topic.UpdateTokenRequest, 'token'>>;

export const STREAM_DESTROYED = 'stream-destroyed';

export class InternalTopicWrite extends EventEmitter {
    // @ts-ignore
    private writeStream?: ClientWritableStream<FromClient>;

    constructor(
        private topicService: InternalTopicService,
        // @ts-ignore
        private logger: Logger,
        // @ts-ignore
        private opts: InternalTopicWriteOpts) {
        super();
        const stream = this.topicService.grpcClient!
            .makeClientStreamRequest<FromClient, FromServer>(
                '/Ydb.Topic.V1.TopicService/StreamWrite',
                (v: FromClient) => FromClient.encode(v).finish() as Buffer,
                FromServer.decode,
                this.topicService.metadata,
                (_err: any /* ServiceError */, _value?: FromServer) => {
                    // TODO: process
                    console.info(1000, _value);
                });
        this.writeStream = stream as ClientWritableStream<FromClient>; // 'as' is here as a quick solution of the fact that TS generates error here
    }

    public init(opts: InitArgs) {
        if (this.writeStream)
            this.writeStream.write(
                FromClient.create({
                    initRequest: Ydb.Topic.StreamWriteMessage.InitRequest.create(opts),
                }));
    }

    public write(opts: WriteArgs) {
        if (this.writeStream)
            this.writeStream.write(
                FromClient.create({
                    writeRequest: Ydb.Topic.StreamWriteMessage.WriteRequest.create(opts),
                }));
    }

    public updateToken(opts: UpdateTokenArgs) {
        if (this.writeStream)
            this.writeStream.write(
                FromClient.create({
                    updateTokenRequest: Ydb.Topic.UpdateTokenRequest.create(opts),
                }));
    }

    public destroy() {
        if (this.writeStream) {
            this.writeStream.end();
            delete this.writeStream;
            this.emit(STREAM_DESTROYED, this);
        }
    }

    // TODO: Update token when the auth provider returns a new one
}
