 import {Logger} from "../../logger/simple-logger";
import {Ydb} from "ydb-sdk-proto";
import {TopicNodeClient} from "./topic-node-client";
import EventEmitter from "events";
import TypedEmitter from "typed-emitter/rxjs";
import {ClientDuplexStream} from "@grpc/grpc-js/build/src/call";
import {TransportError, YdbError} from "../../errors";

export type WriteStreamInitArgs =
    Omit<Ydb.Topic.StreamWriteMessage.IInitRequest, 'messageGroupId'> // Currently, messageGroupId must always equal producerId. this enforced in the TopicNodeClient.openWriteStreamWithEvents method
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

export class TopicWriteStreamWithEvents {
    private _state: TopicWriteStreamState = TopicWriteStreamState.Init;
    private writeBidiStream?: ClientDuplexStream<Ydb.Topic.StreamWriteMessage.FromClient, Ydb.Topic.StreamWriteMessage.FromServer>;

    public get state() {
        return this._state;
    }
    public readonly events = new EventEmitter() as TypedEmitter<WriteStreamEvents>;

    constructor(
        args: WriteStreamInitArgs,
        private topicService: TopicNodeClient,
        // @ts-ignore
        private _logger: Logger) {
        this.topicService.updateMetadata();
        this.writeBidiStream = this.topicService.grpcServiceClient!
            .makeBidiStreamRequest<Ydb.Topic.StreamWriteMessage.FromClient, Ydb.Topic.StreamWriteMessage.FromServer>(
                '/Ydb.Topic.V1.TopicService/StreamWrite',
                (v: Ydb.Topic.StreamWriteMessage.FromClient) => Ydb.Topic.StreamWriteMessage.FromClient.encode(v).finish() as Buffer,
                Ydb.Topic.StreamWriteMessage.FromServer.decode,
                this.topicService.metadata);

        //// Uncomment to see all events
        // const stream = this.writeBidiStream;
        // const oldEmit = stream.emit;
        // stream.emit = ((...args) => {
        //     console.info('write event:', args);
        //     return oldEmit.apply(stream, args as unknown as ['readable']);
        // }) as typeof oldEmit;

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
            if (TransportError.isMember(err)) err = TransportError.convertToYdbError(err); // TODO: As far as I understand the only error here might be a transport error
            this.events.emit('error', err);
        });
        this.writeBidiStream.on('end', () => {
            this._state = TopicWriteStreamState.Closed;
            delete this.writeBidiStream; // so there was no way to send more messages
            this.events.emit('end');
        });
       this.initRequest(args);
    };

    private initRequest(args: WriteStreamInitArgs) {
        this.writeBidiStream!.write(
            Ydb.Topic.StreamWriteMessage.FromClient.create({
                initRequest: Ydb.Topic.StreamWriteMessage.InitRequest.create(args),
            }));
    }

    public writeRequest(args: WriteStreamWriteArgs) {
        if (!this.writeBidiStream) throw new Error('Stream is closed')
        this.writeBidiStream.write(
            Ydb.Topic.StreamWriteMessage.FromClient.create({
                writeRequest: Ydb.Topic.StreamWriteMessage.WriteRequest.create(args),
            }));
    }

    public updateTokenRequest(args: WriteStreamUpdateTokenArgs) {
        if (!this.writeBidiStream) throw new Error('Stream is closed')
        this.writeBidiStream.write(
            Ydb.Topic.StreamWriteMessage.FromClient.create({
                updateTokenRequest: Ydb.Topic.UpdateTokenRequest.create(args),
            }));
    }

    public close() {
        if (!this.writeBidiStream) return;
        this._state = TopicWriteStreamState.Closing;
        this.writeBidiStream.end();
        delete this.writeBidiStream; // so there was no way to send more messages
        // TODO: Should be a way to keep waiting for later ACKs?
    }

    // TODO: Add [dispose] that calls close()

    // TODO: Update token when the auth provider returns a new one
}
