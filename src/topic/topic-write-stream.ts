import {Logger} from "../logger/simple-logger";
import {Ydb} from "ydb-sdk-proto";
import {TopicService} from "./topic-service";
import FromClient = Ydb.Topic.StreamWriteMessage.FromClient;
import FromServer = Ydb.Topic.StreamWriteMessage.FromServer;
import {ClientWritableStream/*, ServiceError*/} from "@grpc/grpc-js/build/src/call";
import EventEmitter from "events";
import {TransportError, YdbError} from "../errors";
// import TypedEmitter from "typed-emitter/rxjs";
// import UpdateTokenResponse = Ydb.Topic.UpdateTokenResponse;
// import {TypedData} from "../types";

// TODO: Typed events
// TODO: Proper stream close/dispose and a reaction on end of stream from server
// TODO: Retries with the same options
// TODO: Batches
// TODO: Zip
// TODO: Sync queue
// TODO: Make as close as posible to pythone API

export type WriteStreamInitArgs =
    Ydb.Topic.StreamWriteMessage.IInitRequest
    & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;
export type WriteStreamInitResult =
    Readonly<Ydb.Topic.StreamWriteMessage.IInitResponse>;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitResponse, 'path'>>;

export type WriteStreamWriteArgs =
    Ydb.Topic.StreamWriteMessage.IWriteRequest
    & Required<Pick<Ydb.Topic.StreamWriteMessage.IWriteRequest, 'messages'>>;
export type WriteStreamWriteResult =
    Ydb.Topic.StreamWriteMessage.IWriteResponse;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IWriteResponse, 'messages'>>;

export type WriteStreamUpdateTokenArgs =
    Ydb.Topic.UpdateTokenRequest
    & Required<Pick<Ydb.Topic.UpdateTokenRequest, 'token'>>;
export type WriteStreamUpdateTokenResult =
    Readonly<Ydb.Topic.UpdateTokenResponse>;
// & Required<Pick<Ydb.Topic.UpdateTokenResponse, 'token'>>;

export const STREAM_DESTROYED = 'stream-destroyed';

// type WriteStreamEvents = {
//     initResponse: (resp: WriteStreamInitResult) => void,
//     writeResponse: (resp: WriteStreamWriteResult) => void,
//     updateTokenResponse: (resp: WriteStreamUpdateTokenResult) => void,
//     end: (cause: any) => void,
// }

export const enum TopicWriteStreamState {
    Init,
    Active,
    Closing,
    Closed
}

export class TopicWriteStream extends EventEmitter /*implements TypedEmitter<WriteStreamEvents>*/ {
    private _state: TopicWriteStreamState = TopicWriteStreamState.Init;
    public get state() {
        return this._state;
    }

    public requestStream?: ClientWritableStream<FromClient>;

    constructor(
        opts: WriteStreamInitArgs,
        private topicService: TopicService,
        // @ts-ignore
        private _logger: Logger) {
        super();
        this.requestStream = this.topicService.grpcClient!
            .makeClientStreamRequest<Ydb.Topic.StreamWriteMessage.FromClient, Ydb.Topic.StreamWriteMessage.FromServer>(
                '/Ydb.Topic.V1.TopicService/StreamWrite',
                (v: FromClient) => FromClient.encode(v).finish() as Buffer,
                FromServer.decode,
                this.topicService.metadata,
                (err: any /* ServiceError */, value?: FromServer) => {
                    try {
                        if (TransportError.isMember(err)) throw TransportError.convertToYdbError(err);
                        if (err) throw err;
                        YdbError.checkStatus(value!)
                    } catch (err) {
                        // TODO: Process end of stream
                        this.emit('error', err);
                        return;
                    }
                    if (value!.writeResponse) this.emit('writeResponse', value!.writeResponse!);
                    else if (value!.initResponse) {
                        this._state = TopicWriteStreamState.Active;
                        this.emit('initResponse', value!.initResponse!);
                    } else if (value!.updateTokenResponse) this.emit('writeResponse', value!.updateTokenResponse!);


                    // end of stream
                    // close / dispose()
                });
        this.init(opts);
    };

    private init(opts: WriteStreamInitArgs) {
        if (!this.requestStream) throw new Error('Stream is not opened')
        console.info(6000, Ydb.Topic.StreamWriteMessage.InitRequest.create(opts))
        this.requestStream.write(
            FromClient.create({
                initRequest: Ydb.Topic.StreamWriteMessage.InitRequest.create(opts),
            }));
    }

    public write(opts: WriteStreamWriteArgs) {
        if (!this.requestStream) throw new Error('Stream is not opened')
        this.requestStream.write(
            FromClient.create({
                writeRequest: Ydb.Topic.StreamWriteMessage.WriteRequest.create(opts),
            }));
    }

    public updateToken(opts: WriteStreamUpdateTokenArgs) {
        if (!this.requestStream) throw new Error('Stream is not opened')
        this.requestStream.write(
            FromClient.create({
                updateTokenRequest: Ydb.Topic.UpdateTokenRequest.create(opts),
            }));
    }

    public async close() {
        if (!this.requestStream) throw new Error('Stream is not opened')
        this.requestStream.end();
        delete this.requestStream; // so there was no way to send more messages
        // TODO: Is there a way to keep waiting for later ACKs?
    }

    public async dispose() {
        await this.close();
        this.emit(STREAM_DESTROYED, this);
        this._state = TopicWriteStreamState.Closed;
    }

    // TODO: Update token when the auth provider returns a new one
}

// const obj = new InternalTopicWrite() as unknown as (TypedEmitter<WriteStreamEvents> & Omit<InternalTopicWrite, 'on' | 'off' | 'emit'>);
//
// obj.on('writeResponse', (args) => {
//
// });
//
// obj.on("test", () => {
//
// })
//
