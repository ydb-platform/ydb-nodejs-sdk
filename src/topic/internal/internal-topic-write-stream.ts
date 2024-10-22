import {Logger} from "../../logger/simple-logger";
import {Ydb} from "ydb-sdk-proto";
import {InternalTopicClient} from "./internal-topic-client";
import EventEmitter from "events";
import TypedEmitter from "typed-emitter/rxjs";
import {ClientDuplexStream} from "@grpc/grpc-js/build/src/call";
import {TransportError, YdbError} from "../../errors";
import {Context} from "../../context";
import {getTokenFromMetadata} from "../../credentials/add-credentials-to-metadata";
import {StatusObject} from "@grpc/grpc-js";

export type InternalWriteStreamInitArgs =
    // Currently, messageGroupId must always be equal to producerId. This enforced in the TopicClientOnParticularNode.openWriteStreamWithEvents method
    Omit<Ydb.Topic.StreamWriteMessage.IInitRequest, 'messageGroupId'>
    & Required<Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'path'>>;
export type InternalWriteStreamInitResult =
    Readonly<Ydb.Topic.StreamWriteMessage.IInitResponse>;

export type InternalWriteStreamWriteArgs =
    Ydb.Topic.StreamWriteMessage.IWriteRequest
    & Required<Pick<Ydb.Topic.StreamWriteMessage.IWriteRequest, 'messages'>>;
export type InternalWriteStreamWriteResult =
    Ydb.Topic.StreamWriteMessage.IWriteResponse;

export type InternalWriteStreamUpdateTokenArgs =
    Ydb.Topic.IUpdateTokenRequest
    & Required<Pick<Ydb.Topic.IUpdateTokenRequest, 'token'>>;
export type InternalWriteStreamUpdateTokenResult =
    Readonly<Ydb.Topic.IUpdateTokenResponse>;

export type WriteStreamEvents = {
    initResponse: (resp: InternalWriteStreamInitResult) => void,
    writeResponse: (resp: InternalWriteStreamWriteResult) => void,
    updateTokenResponse: (resp: InternalWriteStreamUpdateTokenResult) => void,
    error: (err: Error) => void,
    end: (cause: Error) => void,
}

export class InternalTopicWriteStream {
    private reasonForClose?: Error;
    private writeBidiStream?: ClientDuplexStream<Ydb.Topic.StreamWriteMessage.FromClient, Ydb.Topic.StreamWriteMessage.FromServer>;

    public readonly events = new EventEmitter() as TypedEmitter<WriteStreamEvents>;

    constructor(
        ctx: Context,
        private topicService: InternalTopicClient,
        // @ts-ignore
        private logger: Logger) {
        this.logger.trace('%s: new TopicWriteStreamWithEvents()', ctx);
    };

    public async init(
        ctx: Context,
        args: InternalWriteStreamInitArgs
    ) {
        this.logger.trace('%s: TopicWriteStreamWithEvents.init()', ctx);
        await this.topicService.updateMetadata();
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
            this.logger.trace('%s: TopicWriteStreamWithEvents.on "data"', ctx);
            try {
                YdbError.checkStatus(value!)
            } catch (err) {
                this.events.emit('error', err as Error);
                return;
            }
            if (value!.writeResponse) this.events.emit('writeResponse', value!.writeResponse!);
            else if (value!.initResponse) {
                this.events.emit('initResponse', value!.initResponse!);
            } else if (value!.updateTokenResponse) this.events.emit('updateTokenResponse', value!.updateTokenResponse!);
        });
        this.writeBidiStream.on('error', (err) => {
            this.logger.trace('%s: TopicWriteStreamWithEvents.on "error"', ctx);
            if (this.reasonForClose) {
                this.events.emit('end', this.reasonForClose);
            } else {
                err = TransportError.convertToYdbError(err as (Error & StatusObject));
                this.events.emit('error', err);
            }
            this.writeBidiStream!.end();
        });
        this.initRequest(ctx, args);
    }

    private initRequest(ctx: Context, args: InternalWriteStreamInitArgs) {
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

    public async writeRequest(ctx: Context, args: InternalWriteStreamWriteArgs) {
        this.logger.trace('%s: TopicWriteStreamWithEvents.writeRequest()', ctx);
        if (this.reasonForClose) throw new Error('Stream is not open');
        await this.updateToken(ctx);
        this.writeBidiStream!.write(
            Ydb.Topic.StreamWriteMessage.FromClient.create({
                writeRequest: Ydb.Topic.StreamWriteMessage.WriteRequest.create(args),
            }));
    }

    public async updateTokenRequest(ctx: Context, args: InternalWriteStreamUpdateTokenArgs) {
        this.logger.trace('%s: TopicWriteStreamWithEvents.updateTokenRequest()', ctx);
        if (this.reasonForClose) throw new Error('Stream is not open');
        await this.updateToken(ctx);
        this.writeBidiStream!.write(
            Ydb.Topic.StreamWriteMessage.FromClient.create({
                updateTokenRequest: Ydb.Topic.UpdateTokenRequest.create(args),
            }));
    }

    public close(ctx: Context, error?: Error) {
        this.logger.trace('%s: TopicWriteStreamWithEvents.close()', ctx);
        if (this.reasonForClose) throw new Error('Stream is not open');
        this.reasonForClose = error;
        this.writeBidiStream!.cancel();
        this.writeBidiStream!.end();
    }

    // TODO: Add [dispose] that calls close()

    private async updateToken(ctx: Context) {
        this.logger.trace('%s: TopicWriteStreamWithEvents.updateToken()', ctx);
        const oldVal = getTokenFromMetadata(this.topicService.metadata);
        this.topicService.updateMetadata();
        const newVal = getTokenFromMetadata(this.topicService.metadata);
        if (newVal && oldVal !== newVal) await this.updateTokenRequest(ctx, {
            token: newVal
        });
    }
}
