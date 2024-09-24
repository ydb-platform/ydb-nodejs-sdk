import {Logger} from "../../logger/simple-logger";
import {Ydb} from "ydb-sdk-proto";
import {TopicNodeClient} from "./topic-node-client";
import EventEmitter from "events";
import TypedEmitter from "typed-emitter/rxjs";
import {ClientDuplexStream} from "@grpc/grpc-js/build/src/call";
import {TransportError, YdbError} from "../../errors";
import {Context} from "../../context";
import {getCredentialsFromMetadata} from "../../credentials/add-credentials-to-metadata";

export type WriteStreamInitArgs =
    // Currently, messageGroupId must always equal producerId. This enforced in the TopicNodeClient.openWriteStreamWithEvents method
    Omit<Ydb.Topic.StreamWriteMessage.IInitRequest, 'messageGroupId'>
    & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;
export type WriteStreamInitResult =
    Readonly<Ydb.Topic.StreamWriteMessage.IInitResponse>;

export type WriteStreamWriteArgs =
    Ydb.Topic.StreamWriteMessage.IWriteRequest
    & Required<Pick<Ydb.Topic.StreamWriteMessage.IWriteRequest, 'messages'>>;
export type WriteStreamWriteResult =
    Ydb.Topic.StreamWriteMessage.IWriteResponse;

export type WriteStreamUpdateTokenArgs =
    Ydb.Topic.IUpdateTokenRequest
    & Required<Pick<Ydb.Topic.IUpdateTokenRequest, 'token'>>;
export type WriteStreamUpdateTokenResult =
    Readonly<Ydb.Topic.IUpdateTokenResponse>;

export type WriteStreamEvents = {
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
    private state: TopicWriteStreamState = TopicWriteStreamState.Init;
    private writeBidiStream: ClientDuplexStream<Ydb.Topic.StreamWriteMessage.FromClient, Ydb.Topic.StreamWriteMessage.FromServer>;

    public readonly events = new EventEmitter() as TypedEmitter<WriteStreamEvents>;

    constructor(
        ctx: Context,
        args: WriteStreamInitArgs,
        private topicService: TopicNodeClient,
        // @ts-ignore
        private logger: Logger) {

        this.topicService.updateMetadata();
        this.writeBidiStream = this.topicService.grpcServiceClient!
            .makeBidiStreamRequest<Ydb.Topic.StreamWriteMessage.FromClient, Ydb.Topic.StreamWriteMessage.FromServer>(
                '/Ydb.Topic.V1.TopicService/StreamWrite',
                (v: Ydb.Topic.StreamWriteMessage.FromClient) => Ydb.Topic.StreamWriteMessage.FromClient.encode(v).finish() as Buffer,
                Ydb.Topic.StreamWriteMessage.FromServer.decode,
                this.topicService.metadata);

        // debug: logs all events
        // const stream = this.writeBidiStream;
        // const oldEmit = stream.emit;
        // stream.emit = ((...args) => {
        //     this.logger.trace('write event: %o', args);
        //     return oldEmit.apply(stream, args as unknown as ['readable']);
        // }) as typeof oldEmit;

        this.writeBidiStream.on('data', (value) => {
            this.logger.trace('%s: event "data": %o', ctx, value);
            try {
                YdbError.checkStatus(value!)
            } catch (err) {
                this.events.emit('error', err as Error);
                return;
            }
            if (value!.writeResponse) this.events.emit('writeResponse', value!.writeResponse!);
            else if (value!.initResponse) {
                this.state = TopicWriteStreamState.Active;
                this.events.emit('initResponse', value!.initResponse!);
            } else if (value!.updateTokenResponse) this.events.emit('updateTokenResponse', value!.updateTokenResponse!);
        });
        this.writeBidiStream.on('error', (err) => {
            this.logger.trace('%s: event "error": %s', ctx, err);
            if (TransportError.isMember(err)) err = TransportError.convertToYdbError(err); // TODO: As far as I understand the only error here might be a transport error
            this.events.emit('error', err);
        });
        this.writeBidiStream.on('end', () => {
            this.logger.trace('%s: event "end"', ctx);
            this.state = TopicWriteStreamState.Closed;
            this.events.emit('end');
        });
        this.initRequest(ctx, args);
    };

    private initRequest(ctx: Context, args: WriteStreamInitArgs) {
        this.logger.trace('%s: TopicWriteStreamWithEvents.initRequest()', ctx);
        // TODO: Consider zod.js
        this.writeBidiStream!.write(
            Ydb.Topic.StreamWriteMessage.FromClient.create({
                initRequest: Ydb.Topic.StreamWriteMessage.InitRequest.create({
                    ...args,
                    messageGroupId: args.producerId
                }),
            }));
    }

    public async writeRequest(ctx: Context, args: WriteStreamWriteArgs) {
        this.logger.trace('%s: TopicWriteStreamWithEvents.writeRequest()', ctx);
        if (this.state > TopicWriteStreamState.Active) throw new Error('Stream is not active');
        await this.updateToken(ctx);
        this.writeBidiStream.write(
            Ydb.Topic.StreamWriteMessage.FromClient.create({
                writeRequest: Ydb.Topic.StreamWriteMessage.WriteRequest.create(args),
            }));
    }

    public updateTokenRequest(ctx: Context, args: WriteStreamUpdateTokenArgs) {
        this.logger.trace('%s: TopicWriteStreamWithEvents.updateTokenRequest()', ctx);
        if (this.state > TopicWriteStreamState.Active) throw new Error('Stream is not active');
        this.writeBidiStream.write(
            Ydb.Topic.StreamWriteMessage.FromClient.create({
                updateTokenRequest: Ydb.Topic.UpdateTokenRequest.create(args),
            }));
    }

    public close(ctx: Context, fakeError?: Error) {
        this.logger.trace('%s: TopicWriteStreamWithEvents.close()', ctx);
        if (this.state > TopicWriteStreamState.Active) throw new Error('Stream is not active');
        if (fakeError) this.events.emit('error', fakeError);
        this.state = TopicWriteStreamState.Closing;
        this.writeBidiStream.end();
    }

    // TODO: Add [dispose] that calls close()

    // TODO: Update token when the auth provider returns a new one
    private async updateToken(ctx: Context) {
        const oldVal = getCredentialsFromMetadata(this.topicService.metadata);
        this.topicService.updateMetadata();
        const newVal = getCredentialsFromMetadata(this.topicService.metadata);
        if (newVal && oldVal !== newVal) await this.updateTokenRequest(ctx, {
            token: newVal
        });
    }
}
