import {Logger} from "../../logger/simple-logger";
import {Ydb} from "ydb-sdk-proto";
import EventEmitter from "events";
import {TransportError, YdbError} from "../../errors";
import TypedEmitter from "typed-emitter/rxjs";
import {InternalTopicClient} from "./internal-topic-client";
import {ClientDuplexStream} from "@grpc/grpc-js/build/src/call";
import {Context} from "../../context";
import {innerStreamClosedSymbol} from "../symbols";
import {getTokenFromMetadata} from "../../credentials/add-credentials-to-metadata";
import {StatusObject} from "@grpc/grpc-js";

export type InternalReadStreamInitArgs =
    Ydb.Topic.StreamReadMessage.IInitRequest
    & Required<Pick<Ydb.Topic.StreamReadMessage.IInitRequest, 'topicsReadSettings'>>
    & {receiveBufferSizeInBytes: number};
export type InternalReadStreamInitResult = Readonly<Ydb.Topic.StreamReadMessage.IInitResponse>;

export type InternalReadStreamReadArgs = Ydb.Topic.StreamReadMessage.IReadRequest;
export type InternalReadStreamReadResult = Readonly<Ydb.Topic.StreamReadMessage.IReadResponse>;

export type InternalReadStreamCommitOffsetArgs = Ydb.Topic.StreamReadMessage.ICommitOffsetRequest;
export type InternalReadStreamCommitOffsetResult = Readonly<Ydb.Topic.StreamReadMessage.ICommitOffsetResponse>;

export type InternalReadStreamPartitionSessionStatusArgs = Ydb.Topic.StreamReadMessage.IPartitionSessionStatusRequest;
export type InternalReadStreamPartitionSessionStatusResult = Readonly<Ydb.Topic.StreamReadMessage.IPartitionSessionStatusResponse>;

export type InternalReadStreamUpdateTokenArgs = Ydb.Topic.IUpdateTokenRequest;
export type InternalReadStreamUpdateTokenResult = Readonly<Ydb.Topic.IUpdateTokenResponse>;

export type InternalReadStreamStartPartitionSessionArgs = Ydb.Topic.StreamReadMessage.IStartPartitionSessionRequest;
export type InternalReadStreamStartPartitionSessionResult = Readonly<Ydb.Topic.StreamReadMessage.IStartPartitionSessionResponse>;

export type InternalReadStreamStopPartitionSessionArgs = Ydb.Topic.StreamReadMessage.IStopPartitionSessionRequest;
export type InternalReadStreamStopPartitionSessionResult = Readonly<Ydb.Topic.StreamReadMessage.IStopPartitionSessionResponse>;

export type ReadStreamEvents = {
    initResponse: (resp: InternalReadStreamInitResult) => void,
    readResponse: (resp: InternalReadStreamReadResult) => void,
    commitOffsetResponse: (resp: InternalReadStreamCommitOffsetResult) => void,
    partitionSessionStatusResponse: (resp: InternalReadStreamPartitionSessionStatusResult) => void,
    startPartitionSessionRequest: (resp: InternalReadStreamStartPartitionSessionArgs) => void,
    stopPartitionSessionRequest: (resp: InternalReadStreamStopPartitionSessionArgs) => void,
    updateTokenResponse: (resp: InternalReadStreamUpdateTokenResult) => void,
    error: (err: Error) => void,
    end: (cause: Error) => void,
}

export const enum TopicWriteStreamState {
    Init,
    Active,
    Closing,
    Closed
}

export class InternalTopicReadStream {
    public events = new EventEmitter() as TypedEmitter<ReadStreamEvents>;

    private reasonForClose?: Error;
    private readBidiStream?: ClientDuplexStream<Ydb.Topic.StreamReadMessage.FromClient, Ydb.Topic.StreamReadMessage.FromServer>;

    constructor(
        ctx: Context,
        args: InternalReadStreamInitArgs,
        private topicService: InternalTopicClient,
        // @ts-ignore
        public readonly logger: Logger) {
        this.logger.trace('%s: new TopicReadStreamWithEvents()', ctx);
        this.topicService.updateMetadata();
        this.readBidiStream = this.topicService.grpcServiceClient!
            .makeBidiStreamRequest<Ydb.Topic.StreamReadMessage.FromClient, Ydb.Topic.StreamReadMessage.FromServer>(
                '/Ydb.Topic.V1.TopicService/StreamRead',
                (v: Ydb.Topic.StreamReadMessage.IFromClient) => Ydb.Topic.StreamReadMessage.FromClient.encode(v).finish() as Buffer,
                Ydb.Topic.StreamReadMessage.FromServer.decode,
                this.topicService.metadata);

        //// Uncomment to see all events
        // const oldEmit = stream.emit;
        // stream.emit = ((...args) => {
        //     console.info('read event:', args);
        //     return oldEmit.apply(stream, args as unknown as ['readable']);
        // }) as typeof oldEmit;

        this.readBidiStream.on('data', (value) => {
            this.logger.trace('%s: TopicReadStreamWithEvents.on "data"', ctx);
            try {
                try {
                    YdbError.checkStatus(value!)
                } catch (err) {
                    this.events.emit('error', err as Error);
                    return;
                }
                if (value!.readResponse) this.events.emit('readResponse', value!.readResponse! as Ydb.Topic.StreamReadMessage.ReadResponse);
                else if (value!.initResponse) {
                    this.events.emit('initResponse', value!.initResponse! as Ydb.Topic.StreamReadMessage.InitResponse);
                } else if (value!.commitOffsetResponse) this.events.emit('commitOffsetResponse', value!.commitOffsetResponse! as Ydb.Topic.StreamReadMessage.CommitOffsetResponse);
                else if (value!.partitionSessionStatusResponse) this.events.emit('partitionSessionStatusResponse', value!.partitionSessionStatusResponse! as Ydb.Topic.StreamReadMessage.PartitionSessionStatusResponse);
                else if (value!.startPartitionSessionRequest) this.events.emit('startPartitionSessionRequest', value!.startPartitionSessionRequest! as Ydb.Topic.StreamReadMessage.StartPartitionSessionRequest);
                else if (value!.stopPartitionSessionRequest) this.events.emit('stopPartitionSessionRequest', value!.stopPartitionSessionRequest! as Ydb.Topic.StreamReadMessage.StopPartitionSessionRequest);
                else if (value!.updateTokenResponse) this.events.emit('updateTokenResponse', value!.updateTokenResponse! as Ydb.Topic.UpdateTokenResponse);
            } catch (err) {
                this.events.emit('error', err as Error);
            }
        })
        this.readBidiStream.on('error', (err) => {
            this.logger.trace('%s: TopicReadStreamWithEvents.on "error"', ctx);
            if (this.reasonForClose) {
                this.events.emit('end', err);
            } else {
                this.events.emit('error', TransportError.convertToYdbError(err as (Error & StatusObject)));
            }
        })
        this.initRequest(ctx, args);
    };

    private initRequest(ctx: Context, args: InternalReadStreamInitArgs) {
        this.logger.trace('%s: TopicReadStreamWithEvents.initRequest()', ctx);
        this.readBidiStream!.write(
            Ydb.Topic.StreamReadMessage.create({
                initRequest: Ydb.Topic.StreamReadMessage.InitRequest.create(args),
            }));
    }

    public async readRequest(ctx: Context, args: InternalReadStreamReadArgs) {
        this.logger.trace('%s: TopicReadStreamWithEvents.readRequest()', ctx);
        if (!this.readBidiStream) throw new Error('Stream is closed')
        await this.updateToken(ctx);
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                readRequest: Ydb.Topic.StreamReadMessage.ReadRequest.create(args),
            }));
    }

    public async commitOffsetRequest(ctx: Context, args: InternalReadStreamCommitOffsetArgs) {
        this.logger.trace('%s: TopicReadStreamWithEvents.commitOffsetRequest()', ctx);
        if (!this.readBidiStream) {
            const err = new Error('Inner stream where from the message was received is closed. The message needs to be re-processed.');
            (err as any).cause = innerStreamClosedSymbol;
            throw err;
        }
        await this.updateToken(ctx);
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                commitOffsetRequest: Ydb.Topic.StreamReadMessage.CommitOffsetRequest.create(args),
            }));
    }

    public async partitionSessionStatusRequest(ctx: Context, args: InternalReadStreamPartitionSessionStatusArgs) {
        this.logger.trace('%s: TopicReadStreamWithEvents.partitionSessionStatusRequest()', ctx);
        if (!this.readBidiStream) throw new Error('Stream is closed')
        await this.updateToken(ctx);
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                partitionSessionStatusRequest: Ydb.Topic.StreamReadMessage.PartitionSessionStatusRequest.create(args),
            }));
    }

    public async updateTokenRequest(ctx: Context, args: InternalReadStreamUpdateTokenArgs) {
        this.logger.trace('%s: TopicReadStreamWithEvents.updateTokenRequest()', ctx);
        if (!this.readBidiStream) throw new Error('Stream is closed')
        await this.updateToken(ctx);
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                updateTokenRequest: Ydb.Topic.UpdateTokenRequest.create(args),
            }));
        // TODO: process response
    }

    public async startPartitionSessionResponse(ctx: Context, args: InternalReadStreamStartPartitionSessionResult) {
        this.logger.trace('%s: TopicReadStreamWithEvents.startPartitionSessionResponse()', ctx);
        if (!this.readBidiStream) throw new Error('Stream is closed')
        await this.updateToken(ctx);
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                startPartitionSessionResponse: Ydb.Topic.StreamReadMessage.StartPartitionSessionResponse.create(args),
            }));
    }

    public async stopPartitionSessionResponse(ctx: Context, args: InternalReadStreamStopPartitionSessionResult) {
        this.logger.trace('%s: TopicReadStreamWithEvents.stopPartitionSessionResponse()', ctx);
        if (this.reasonForClose) throw new Error('Stream is not open');
        await this.updateToken(ctx);
        this.readBidiStream!.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                stopPartitionSessionResponse: Ydb.Topic.StreamReadMessage.StopPartitionSessionResponse.create(args),
            }));
    }

    public close(ctx: Context, error?: Error) {
        this.logger.trace('%s: TopicReadStreamWithEvents.close()', ctx);
        if (this.reasonForClose) throw new Error('Stream is not open');
        this.reasonForClose = error;
        this.readBidiStream!.cancel();
    }

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
