import {Logger} from "../logger/simple-logger";
import {Ydb} from "ydb-sdk-proto";
import EventEmitter from "events";
import {TransportError, YdbError} from "../errors";
import TypedEmitter from "typed-emitter/rxjs";
import {TopicService} from "./topic-service";
import {ClientDuplexStream} from "@grpc/grpc-js/build/src/call";

export type ReadStreamInitArgs = Ydb.Topic.StreamReadMessage.IInitRequest;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;
export type ReadStreamInitResult = Ydb.Topic.StreamReadMessage.IInitResponse;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitResponse, 'path'>>;

export type ReadStreamReadArgs = Ydb.Topic.StreamReadMessage.IReadRequest;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;
export type ReadStreamReadResult = Ydb.Topic.StreamReadMessage.IReadResponse;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitResponse, 'path'>>;

export type ReadStreamCommitOffsetArgs = Ydb.Topic.StreamReadMessage.ICommitOffsetRequest;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;
export type ReadStreamCommitOffsetResult = Ydb.Topic.StreamReadMessage.ICommitOffsetResponse;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitResponse, 'path'>>;

export type ReadStreamPartitionSessionStatusArgs = Ydb.Topic.StreamReadMessage.IPartitionSessionStatusRequest;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;
export type ReadStreamPartitionSessionStatusResult = Ydb.Topic.StreamReadMessage.IPartitionSessionStatusResponse;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitResponse, 'path'>>;

export type ReadStreamUpdateTokenArgs = Ydb.Topic.IUpdateTokenRequest;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;
export type ReadStreamUpdateTokenResult = Ydb.Topic.IUpdateTokenResponse;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitResponse, 'path'>>;

export type ReadStreamStartPartitionSessionArgs = Ydb.Topic.StreamReadMessage.IStartPartitionSessionRequest;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;
export type ReadStreamStartPartitionSessionResult = Ydb.Topic.StreamReadMessage.IStartPartitionSessionResponse;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitResponse, 'path'>>;

export type ReadStreamStopPartitionSessionArgs = Ydb.Topic.StreamReadMessage.IStopPartitionSessionRequest;
// & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;
export type ReadStreamStopPartitionSessionResult = Ydb.Topic.StreamReadMessage.IStopPartitionSessionResponse;
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

    public readBidiStream?: ClientDuplexStream<Ydb.Topic.StreamReadMessage.FromClient, Ydb.Topic.StreamReadMessage.FromServer>;

    constructor(
        opts: ReadStreamInitArgs,
        private topicService: TopicService,
        // @ts-ignore
        private _logger: Logger) {
        this.readBidiStream = this.topicService.grpcServiceClient!
            .makeBidiStreamRequest<Ydb.Topic.StreamReadMessage.FromClient, Ydb.Topic.StreamReadMessage.FromServer>(
                '/Ydb.Topic.V1.TopicService/StreamRead',
                (v: Ydb.Topic.StreamReadMessage.IFromClient) => Ydb.Topic.StreamReadMessage.FromClient.encode(v).finish() as Buffer,
                Ydb.Topic.StreamReadMessage.FromServer.decode,
                this.topicService.metadata);
        this.readBidiStream.on('data', (value) => {
             console.info(2000, value)
            try {
                YdbError.checkStatus(value!)
            } catch (err) {
                this.events.emit('error', err as Error);
                return;
            }
            if (value!.readResponse) this.events.emit('readResponse', value!.readResponse! as Ydb.Topic.StreamReadMessage.ReadResponse);
            else if (value!.initResponse) {
                this._state = TopicWriteStreamState.Active;
                this.events.emit('initResponse', value!.initResponse! as Ydb.Topic.StreamReadMessage.InitResponse);
            } else if (value!.commitOffsetResponse) this.events.emit('commitOffsetResponse', value!.commitOffsetResponse! as Ydb.Topic.StreamReadMessage.CommitOffsetResponse);
            else if (value!.partitionSessionStatusResponse) this.events.emit('partitionSessionStatusResponse', value!.partitionSessionStatusResponse! as Ydb.Topic.StreamReadMessage.PartitionSessionStatusResponse);
            else if (value!.startPartitionSessionRequest) this.events.emit('startPartitionSessionRequest', value!.startPartitionSessionRequest! as Ydb.Topic.StreamReadMessage.StartPartitionSessionRequest);
            else if (value!.stopPartitionSessionRequest) this.events.emit('stopPartitionSessionRequest', value!.stopPartitionSessionRequest! as Ydb.Topic.StreamReadMessage.StopPartitionSessionRequest);
            else if (value!.updateTokenResponse) this.events.emit('updateTokenResponse', value!.updateTokenResponse! as Ydb.Topic.UpdateTokenResponse);
        })
        this.readBidiStream.on('error', (err) => {
            if (TransportError.isMember(err)) err = TransportError.convertToYdbError(err);
            this.events.emit('error', err);
        })
        // this.writeBidiStream.on('status', (v) => {
        //     console.info(8200, v);
        // })
        // this.writeBidiStream.on('metadata', (v) => {
        //     console.info(8000, v);
        // })
        // this.writeBidiStream.on('finish', (v: any) => {
        //     console.info(8060, v);
        // })

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
