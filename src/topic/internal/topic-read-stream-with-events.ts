import {Logger} from "../../logger/simple-logger";
import {Ydb} from "ydb-sdk-proto";
import EventEmitter from "events";
import {TransportError, YdbError} from "../../errors";
import TypedEmitter from "typed-emitter/rxjs";
import {TopicNodeClient} from "./topic-node-client";
import {ClientDuplexStream} from "@grpc/grpc-js/build/src/call";
import {Context} from "../../context";
import {closedForCommitsSymbol} from "../symbols";

export type ReadStreamInitArgs = Ydb.Topic.StreamReadMessage.IInitRequest;
export type ReadStreamInitResult = Readonly<Ydb.Topic.StreamReadMessage.IInitResponse>;

export type ReadStreamReadArgs = Ydb.Topic.StreamReadMessage.IReadRequest;
export type ReadStreamReadResult = Readonly<Ydb.Topic.StreamReadMessage.IReadResponse>;

export type ReadStreamCommitOffsetArgs = Ydb.Topic.StreamReadMessage.ICommitOffsetRequest;
export type ReadStreamCommitOffsetResult = Readonly<Ydb.Topic.StreamReadMessage.ICommitOffsetResponse>;

export type ReadStreamPartitionSessionStatusArgs = Ydb.Topic.StreamReadMessage.IPartitionSessionStatusRequest;
export type ReadStreamPartitionSessionStatusResult = Readonly<Ydb.Topic.StreamReadMessage.IPartitionSessionStatusResponse>;

export type ReadStreamUpdateTokenArgs = Ydb.Topic.IUpdateTokenRequest;
export type ReadStreamUpdateTokenResult = Readonly<Ydb.Topic.IUpdateTokenResponse>;

export type ReadStreamStartPartitionSessionArgs = Ydb.Topic.StreamReadMessage.IStartPartitionSessionRequest;
export type ReadStreamStartPartitionSessionResult = Readonly<Ydb.Topic.StreamReadMessage.IStartPartitionSessionResponse>;

export type ReadStreamStopPartitionSessionArgs = Ydb.Topic.StreamReadMessage.IStopPartitionSessionRequest;
export type ReadStreamStopPartitionSessionResult = Readonly<Ydb.Topic.StreamReadMessage.IStopPartitionSessionResponse>;

export type ReadStreamEvents = {
    initResponse: (resp: ReadStreamInitResult) => void,
    readResponse: (resp: ReadStreamReadResult) => void,
    commitOffsetResponse: (resp: ReadStreamCommitOffsetResult) => void,
    partitionSessionStatusResponse: (resp: ReadStreamPartitionSessionStatusResult) => void,
    startPartitionSessionRequest: (resp: ReadStreamStartPartitionSessionArgs) => void,
    stopPartitionSessionRequest: (resp: ReadStreamStopPartitionSessionArgs) => void,
    updateTokenResponse: (resp: ReadStreamUpdateTokenResult) => void,
    error: (err: Error) => void,
    end: () => void,
}

export const enum TopicWriteStreamState {
    Init,
    Active,
    Closing,
    Closed
}

export class TopicReadStreamWithEvents {
    public events = new EventEmitter() as TypedEmitter<ReadStreamEvents>;

    [closedForCommitsSymbol]?: boolean;

    private readBidiStream?: ClientDuplexStream<Ydb.Topic.StreamReadMessage.FromClient, Ydb.Topic.StreamReadMessage.FromServer>;

    constructor(
        ctx: Context,
        args: ReadStreamInitArgs,
        private topicService: TopicNodeClient,
        // @ts-ignore
        public readonly logger: Logger) {
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
            if (TransportError.isMember(err)) err = TransportError.convertToYdbError(err);
            this.events.emit('error', err);
        })
        this.readBidiStream.on('end', () => {
            this[closedForCommitsSymbol] = true;
            delete this.readBidiStream; // so there will be no way to send more messages
            this.events.emit('end');
        });
        this.initRequest(ctx, args);
    };

    private initRequest(ctx: Context, args: ReadStreamInitArgs) {
        this.logger.trace('%s: TopicReadStreamWithEvents.initRequest()', ctx);
        this.readBidiStream!.write(
            Ydb.Topic.StreamReadMessage.create({
                initRequest: Ydb.Topic.StreamReadMessage.InitRequest.create(args),
            }));
    }

    public readRequest(ctx: Context, args: ReadStreamReadArgs) {
        this.logger.trace('%s: TopicReadStreamWithEvents.readRequest()', ctx);
        if (!this.readBidiStream) throw new Error('Stream is closed')
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                readRequest: Ydb.Topic.StreamReadMessage.ReadRequest.create(args),
            }));
    }

    public commitOffsetRequest(ctx: Context, args: ReadStreamCommitOffsetArgs) {
        this.logger.trace('%s: TopicReadStreamWithEvents.commitOffsetRequest()', ctx);
        if (!this.readBidiStream) throw new Error('Stream is closed')
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                commitOffsetRequest: Ydb.Topic.StreamReadMessage.CommitOffsetRequest.create(args),
            }));
    }

    public partitionSessionStatusRequest(ctx: Context, args: ReadStreamPartitionSessionStatusArgs) {
        this.logger.trace('%s: TopicReadStreamWithEvents.partitionSessionStatusRequest()', ctx);
        if (!this.readBidiStream) throw new Error('Stream is closed')
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                partitionSessionStatusRequest: Ydb.Topic.StreamReadMessage.PartitionSessionStatusRequest.create(args),
            }));
    }

    public updateTokenRequest(ctx: Context, args: ReadStreamUpdateTokenArgs) {
        this.logger.trace('%s: TopicReadStreamWithEvents.updateTokenRequest()', ctx);
        if (!this.readBidiStream) throw new Error('Stream is closed')
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                updateTokenRequest: Ydb.Topic.UpdateTokenRequest.create(args),
            }));
    }

    public startPartitionSessionResponse(ctx: Context, args: ReadStreamStartPartitionSessionResult) {
        this.logger.trace('%s: TopicReadStreamWithEvents.startPartitionSessionResponse()', ctx);
        if (!this.readBidiStream) throw new Error('Stream is closed')
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                startPartitionSessionResponse: Ydb.Topic.StreamReadMessage.StartPartitionSessionResponse.create(args),
            }));
    }

    public stopPartitionSessionResponse(ctx: Context, args: ReadStreamStopPartitionSessionResult) {
        this.logger.trace('%s: TopicReadStreamWithEvents.stopPartitionSessionResponse()', ctx);
        if (!this.readBidiStream) throw new Error('Stream is closed')
        this.readBidiStream.write(
            Ydb.Topic.StreamReadMessage.FromClient.create({
                stopPartitionSessionResponse: Ydb.Topic.StreamReadMessage.StopPartitionSessionResponse.create(args),
            }));
    }

    public async close(ctx: Context, fakeError?: Error) {
        this.logger.trace('%s: TopicReadStreamWithEvents.close()', ctx);
        if (!this.readBidiStream) return;
        if (fakeError) this.readBidiStream.emit('error', fakeError);
        this.readBidiStream.end();
        delete this.readBidiStream; // so there was no way to send more messages
    }

    // TODO: Update token when the auth provider returns a new one
}
