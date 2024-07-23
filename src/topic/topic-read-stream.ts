import {Logger} from "../logger/simple-logger";
import {Ydb} from "ydb-sdk-proto";
import {ClientWritableStream/*, ServiceError*/} from "@grpc/grpc-js/build/src/call";
import EventEmitter from "events";
import {TransportError, YdbError} from "../errors";
import TypedEmitter from "typed-emitter/rxjs";
import {TopicService} from "./topic-service";

export type ReadStreamInitArgs = Ydb.Topic.StreamReadMessage.InitRequest;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;
export type ReadStreamInitResult = Ydb.Topic.StreamReadMessage.InitResponse;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitResponse, 'path'>>;

export type ReadStreamReadArgs = Ydb.Topic.StreamReadMessage.ReadRequest;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;
export type ReadStreamReadResult = Ydb.Topic.StreamReadMessage.ReadResponse;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitResponse, 'path'>>;

export type ReadStreamCommitOffsetArgs = Ydb.Topic.StreamReadMessage.CommitOffsetRequest;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;
export type ReadStreamCommitOffsetResult = Ydb.Topic.StreamReadMessage.CommitOffsetResponse;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitResponse, 'path'>>;

export type ReadStreamPartitionSessionStatusArgs = Ydb.Topic.StreamReadMessage.PartitionSessionStatusRequest;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;
export type ReadStreamPartitionSessionStatusResult = Ydb.Topic.StreamReadMessage.PartitionSessionStatusResponse;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitResponse, 'path'>>;

export type ReadStreamUpdateTokenArgs = Ydb.Topic.UpdateTokenRequest;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;
export type ReadStreamUpdateTokenResult = Ydb.Topic.UpdateTokenResponse;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitResponse, 'path'>>;

export type ReadStreamStartPartitionSessionArgs = Ydb.Topic.StreamReadMessage.StartPartitionSessionRequest;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;
export type ReadStreamStartPartitionSessionResult = Ydb.Topic.StreamReadMessage.StartPartitionSessionResponse;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitResponse, 'path'>>;

export type ReadStreamStopPartitionSessionArgs = Ydb.Topic.StreamReadMessage.StopPartitionSessionRequest;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;
export type ReadStreamStopPartitionSessionResult = Ydb.Topic.StreamReadMessage.StopPartitionSessionResponse;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitResponse, 'path'>>;

export const STREAM_DESTROYED = 'stream-destroyed';

type ReadStreamEvents = {
    initResponse: (resp: ReadStreamInitResult) => void,
    readResponse: (resp: ReadStreamReadResult) => void,
    commitOffsetResponse: (resp: ReadStreamCommitOffsetResult) => void,
    partitionSessionStatusResponse: (resp: ReadStreamPartitionSessionStatusResult) => void,
    startPartitionSessionRequest: (resp: ReadStreamStartPartitionSessionArgs) => void,
    stopPartitionSessionRequest: (resp: ReadStreamStopPartitionSessionArgs) => void,

    updateTokenResponse: (resp: ReadStreamUpdateTokenResult) => void,

    error: (err: Error) => void,
    'stream-destroyed': (stream: { dispose: () => {} }) => void, // TODO: Is end is not enough
    end: (cause: any) => void,
}

export const enum TopicWriteStreamState {
    Init,
    Active,
    Closing,
    Closed
}

export class TopicReadStream {
    public events = new EventEmitter() as TypedEmitter<ReadStreamEvents>;

    private _state: TopicWriteStreamState = TopicWriteStreamState.Init;
    public get state() {
        return this._state;
    }

    public readBidiStream?: ClientWritableStream<Ydb.Topic.StreamReadMessage.FromClient>;

    constructor(
        opts: ReadStreamInitArgs,
        private topicService: TopicService,
        // @ts-ignore
        private _logger: Logger) {
        this.readBidiStream = this.topicService.grpcServiceClient!
            .makeClientStreamRequest<Ydb.Topic.StreamReadMessage.FromClient, Ydb.Topic.StreamReadMessage.FromServer>(
                '/Ydb.Topic.V1.TopicService/StreamRead',
                (v: Ydb.Topic.StreamReadMessage.IFromClient) => Ydb.Topic.StreamReadMessage.FromClient.encode(v).finish() as Buffer,
                Ydb.Topic.StreamReadMessage.FromServer.decode,
                this.topicService.metadata,
                (err: any /* ServiceError */, value?: Ydb.Topic.StreamReadMessage.FromServer) => {
                    try {
                        if (TransportError.isMember(err)) throw TransportError.convertToYdbError(err);
                        if (err) throw err;
                        YdbError.checkStatus(value!)
                    } catch (err) {
                        // TODO: Process end of stream
                        this.events.emit('error', err as Error);
                        return;
                    }

                    // TODO: Optimize selection
                    if (value!.readResponse) this.events.emit('readResponse', value!.readResponse! as Ydb.Topic.StreamReadMessage.ReadResponse);
                    else if (value!.initResponse) {
                        this._state = TopicWriteStreamState.Active;
                        this.events.emit('initResponse', value!.initResponse! as Ydb.Topic.StreamReadMessage.InitResponse);
                    } else if (value!.commitOffsetResponse) this.events.emit('commitOffsetResponse', value!.commitOffsetResponse! as Ydb.Topic.StreamReadMessage.CommitOffsetResponse);
                    else if (value!.partitionSessionStatusResponse) this.events.emit('partitionSessionStatusResponse', value!.partitionSessionStatusResponse! as Ydb.Topic.StreamReadMessage.PartitionSessionStatusResponse);
                    else if (value!.startPartitionSessionRequest) this.events.emit('startPartitionSessionRequest', value!.startPartitionSessionRequest! as Ydb.Topic.StreamReadMessage.StartPartitionSessionRequest);
                    else if (value!.stopPartitionSessionRequest) this.events.emit('stopPartitionSessionRequest', value!.stopPartitionSessionRequest! as Ydb.Topic.StreamReadMessage.StopPartitionSessionRequest);
                    else if (value!.updateTokenResponse) this.events.emit('updateTokenResponse', value!.updateTokenResponse! as Ydb.Topic.UpdateTokenResponse);
                });
        this.initRequest(opts);
    };

    private initRequest(opts: ReadStreamInitArgs) {
        if (!this.readBidiStream) throw new Error('Stream is not opened')
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.create({
                initRequest: Ydb.Topic.StreamReadMessage.InitRequest.create(opts),
            }));
    }

    public readRequest(opts: ReadStreamReadArgs) {
        if (!this.readBidiStream) throw new Error('Stream is not opened')
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                readRequest: Ydb.Topic.StreamReadMessage.ReadRequest.create(opts),
            }));
    }

    public commitOffsetRequest(opts: ReadStreamCommitOffsetArgs) {
        if (!this.readBidiStream) throw new Error('Stream is not opened')
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                commitOffsetRequest: Ydb.Topic.StreamReadMessage.CommitOffsetRequest.create(opts),
            }));
    }

    public partitionSessionStatusRequest(opts: ReadStreamPartitionSessionStatusArgs) {
        if (!this.readBidiStream) throw new Error('Stream is not opened')
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                partitionSessionStatusRequest: Ydb.Topic.StreamReadMessage.PartitionSessionStatusRequest.create(opts),
            }));
    }

    public updateTokenRequest(opts: ReadStreamUpdateTokenArgs) {
        if (!this.readBidiStream) throw new Error('Stream is not opened')
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                updateTokenRequest: Ydb.Topic.UpdateTokenRequest.create(opts),
            }));
    }

    public startPartitionSessionResponse(opts: ReadStreamStartPartitionSessionResult) {
        if (!this.readBidiStream) throw new Error('Stream is not opened')
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                startPartitionSessionResponse: Ydb.Topic.StreamReadMessage.StartPartitionSessionResponse.create(opts),
            }));
    }

    public stopPartitionSessionResponse(opts: ReadStreamStopPartitionSessionResult) {
        if (!this.readBidiStream) throw new Error('Stream is not opened')
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                stopPartitionSessionResponse: Ydb.Topic.StreamReadMessage.StopPartitionSessionResponse.create(opts),
            }));
    }

    public async close() {
        if (!this.readBidiStream) throw new Error('Stream is not opened')
        this.readBidiStream.end();
        delete this.readBidiStream; // so there was no way to send more messages
        // TODO: Is there a way to keep waiting for later ACKs?
    }

    public async dispose() {
        await this.close();
        this.events.emit(STREAM_DESTROYED, this);
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
