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

type WriteStreamEvents = {
    initResponse: (resp: WriteStreamInitResult) => void,
    writeResponse: (resp: WriteStreamWriteResult) => void,
    updateTokenResponse: (resp: WriteStreamUpdateTokenResult) => void,
    error: (err: Error) => void,
    end: () => void,
}

export const enum TopicWriteStreamState {
    Init,
    Active,
    Closing,
    Closed
}

export class TopicWriteStreamWithEvent {
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

        //// Uncomment to see all events
        const stream = this.writeBidiStream;
        const oldEmit = stream.emit;
        stream.emit = ((...args) => {
            console.info('write event:', args);
            return oldEmit.apply(stream, args as unknown as ['readable']);
        }) as typeof oldEmit;

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
            } else if (value!.updateTokenResponse) this.events.emit('updateTokenResponse', value!.updateTokenResponse!);
        });
        this.writeBidiStream.on('error', (err) => {
            if (TransportError.isMember(err)) err = TransportError.convertToYdbError(err);
            this.events.emit('error', err);
        });
        this.writeBidiStream.on('end', () => {
            console.info(3000)
            this._state = TopicWriteStreamState.Closed;
            delete this.writeBidiStream; // so there was no way to send more messages
            setTimeout(() => this.events.emit('end'), 0);
        });
       this.initRequest(opts);
    };

    private initRequest(opts: WriteStreamInitArgs) {
        this.writeBidiStream!.write(
            Ydb.Topic.StreamWriteMessage.FromClient.create({
                initRequest: Ydb.Topic.StreamWriteMessage.InitRequest.create(opts),
            }));
    }

    public writeRequest(opts: WriteStreamWriteArgs) {
        if (!this.writeBidiStream) throw new Error('Stream is closed')
        this.writeBidiStream.write(
            Ydb.Topic.StreamWriteMessage.FromClient.create({
                writeRequest: Ydb.Topic.StreamWriteMessage.WriteRequest.create(opts),
            }));
    }

    public updateTokenRequest(opts: WriteStreamUpdateTokenArgs) {
        if (!this.writeBidiStream) throw new Error('Stream is closed')
        this.writeBidiStream.write(
            Ydb.Topic.StreamWriteMessage.FromClient.create({
                updateTokenRequest: Ydb.Topic.UpdateTokenRequest.create(opts),
            }));
    }

    public close() {
        if (!this.writeBidiStream) return;
        this._state = TopicWriteStreamState.Closing;
        this.writeBidiStream.end();
        delete this.writeBidiStream; // so there was no way to send more messages
        // TODO: Should be a way to keep waiting for later ACKs?
    }

    // TODO: Add [dispose] that call close()

    // TODO: Update token when the auth provider returns a new one
}
