import {Logger} from "../logger/simple-logger";
import {Ydb} from "ydb-sdk-proto";
import {TopicService} from "./topic-service";
import EventEmitter from "events";
import TypedEmitter from "typed-emitter/rxjs";
import {ClientDuplexStream} from "@grpc/grpc-js/build/src/call";
import {TransportError, YdbError} from "../errors";

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

type WriteStreamEvents = {
    initResponse: (resp: WriteStreamInitResult) => void,
    writeResponse: (resp: WriteStreamWriteResult) => void,

    updateTokenResponse: (resp: WriteStreamUpdateTokenResult) => void,

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

export class TopicWriteStream {
    public events = new EventEmitter() as TypedEmitter<WriteStreamEvents>;

    private _state: TopicWriteStreamState = TopicWriteStreamState.Init;
    public get state() {
        return this._state;
    }

    public writeBidiStream?: ClientDuplexStream<Ydb.Topic.StreamWriteMessage.FromClient, Ydb.Topic.StreamWriteMessage.FromServer>;

    constructor(
        opts: WriteStreamInitArgs,
        private topicService: TopicService,
        // @ts-ignore
        private _logger: Logger) {
        this.writeBidiStream = this.topicService.grpcServiceClient!
            .makeBidiStreamRequest<Ydb.Topic.StreamWriteMessage.FromClient, Ydb.Topic.StreamWriteMessage.FromServer>(
                '/Ydb.Topic.V1.TopicService/StreamWrite',
                (v: Ydb.Topic.StreamWriteMessage.FromClient) => Ydb.Topic.StreamWriteMessage.FromClient.encode(v).finish() as Buffer,
                Ydb.Topic.StreamWriteMessage.FromServer.decode,
                this.topicService.metadata);

        this.writeBidiStream.on('data', (value) => {
            try {
                YdbError.checkStatus(value!)
            } catch (err) {
                this.events.emit('error', err as Error);
                return;
            }
            if (value!.writeResponse) this.events.emit('writeResponse', value!.writeResponse!);
            else if (value!.initResponse) {
                this._state = TopicWriteStreamState.Active;
                this.events.emit('initResponse', value!.initResponse!);
            } else if (value!.updateTokenResponse) this.events.emit('writeResponse', value!.updateTokenResponse!);
        })
        this.writeBidiStream.on('error', (err) => {
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
       this.initRequest(opts); // TODO: Think of retry cycle
    };

    private initRequest(opts: WriteStreamInitArgs) {
        if (!this.writeBidiStream) throw new Error('Stream is not opened')
        this.writeBidiStream.write(
            Ydb.Topic.StreamWriteMessage.FromClient.create({
                initRequest: Ydb.Topic.StreamWriteMessage.InitRequest.create(opts),
            }));
    }

    public writeRequest(opts: WriteStreamWriteArgs) {
        if (!this.writeBidiStream) throw new Error('Stream is not opened')
        this.writeBidiStream.write(
            Ydb.Topic.StreamWriteMessage.FromClient.create({
                writeRequest: Ydb.Topic.StreamWriteMessage.WriteRequest.create(opts),
            }));
    }

    public updateTokenRequest(opts: WriteStreamUpdateTokenArgs) {
        if (!this.writeBidiStream) throw new Error('Stream is not opened')
        this.writeBidiStream.write(
            Ydb.Topic.StreamWriteMessage.FromClient.create({
                updateTokenRequest: Ydb.Topic.UpdateTokenRequest.create(opts),
            }));
    }

    public async close() {
        if (!this.writeBidiStream) throw new Error('Stream is not opened')
        this.writeBidiStream.end();
        delete this.writeBidiStream; // so there was no way to send more messages
        // TODO: Is there a way to keep waiting for later ACKs?
    }

    public async dispose() {
        await this.close();
        this.events.emit(STREAM_DESTROYED, this);
        this._state = TopicWriteStreamState.Closed;
    }

    // TODO: Update token when the auth provider returns a new one
}
