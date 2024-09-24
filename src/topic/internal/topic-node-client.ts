import {Endpoint} from "../../discovery";
import {Ydb} from "ydb-sdk-proto";

import {Logger} from "../../logger/simple-logger";
import ICreateTopicResult = Ydb.Topic.ICreateTopicResult;
import {AuthenticatedService, ClientOptions} from "../../utils";
import {IAuthService} from "../../credentials/i-auth-service";
import {ISslCredentials} from "../../utils/ssl-credentials";
import {TopicWriteStreamWithEvents, WriteStreamInitArgs} from "./topic-write-stream-with-events";
import {TopicReadStreamWithEvents, ReadStreamInitArgs} from "./topic-read-stream-with-events";
import {v4 as uuid_v4} from 'uuid';
import {Context} from "../../context";
import * as grpc from "@grpc/grpc-js";

// TODO: Retries with the same options
// TODO: Batches
// TODO: Zip compression
// TODO: Regular auth token update
// TODO: Graceful shutdown and close

export type CommitOffsetArgs =
    Ydb.Topic.ICommitOffsetRequest
    & Required<Pick<Ydb.Topic.ICommitOffsetRequest, 'path' | 'consumer' | 'offset'>>;
export type CommitOffsetResult = Readonly<Ydb.Topic.CommitOffsetResponse>;

export type UpdateOffsetsInTransactionArgs =
    Ydb.Topic.IUpdateOffsetsInTransactionRequest
    & Required<Pick<Ydb.Topic.UpdateOffsetsInTransactionRequest, 'topics' | 'consumer'>>;
export type UpdateOffsetsInTransactionResult = Readonly<Ydb.Topic.UpdateOffsetsInTransactionResponse>;

export type CreateTopicArgs = Ydb.Topic.ICreateTopicRequest & Required<Pick<Ydb.Topic.ICreateTopicRequest, 'path'>>;
export type CreateTopicResult = Readonly<Ydb.Topic.CreateTopicResponse>;

export type DescribeTopicArgs =
    Ydb.Topic.IDescribeTopicRequest
    & Required<Pick<Ydb.Topic.IDescribeTopicRequest, 'path'>>;
export type DescribeTopicResult = Readonly<Ydb.Topic.DescribeTopicResponse>;

export type DescribeConsumerArgs =
    Ydb.Topic.IDescribeConsumerRequest
    & Required<Pick<Ydb.Topic.IDescribeConsumerRequest, 'path' | 'consumer'>>;
export type DescribeConsumerResult = Readonly<Ydb.Topic.DescribeConsumerResponse>;

export type AlterTopicArgs = Ydb.Topic.IAlterTopicRequest & Required<Pick<Ydb.Topic.IAlterTopicRequest, 'path'>>;
export type AlterTopicResult = Readonly<Ydb.Topic.AlterTopicResponse>
export type DropTopicArgs = Ydb.Topic.IDropTopicRequest & Required<Pick<Ydb.Topic.IDropTopicRequest, 'path'>>;
export type DropTopicResult = Readonly<Ydb.Topic.DropTopicResponse>;

export class TopicNodeClient extends AuthenticatedService<Ydb.Topic.V1.TopicService> implements ICreateTopicResult {
    public endpoint: Endpoint;
    private readonly logger: Logger;
    private allStreams: { close(ctx: Context, fakeError?: Error): void }[] = [];
    private destroyResolve?: (value: unknown) => void;

    constructor(endpoint: Endpoint, database: string, authService: IAuthService, logger: Logger, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions) {
        const host = endpoint.toString();
        const nodeClient = sslCredentials
            ? new grpc.Client(host, grpc.credentials.createSsl(sslCredentials.rootCertificates, sslCredentials.clientCertChain, sslCredentials.clientPrivateKey), clientOptions)
            : new grpc.Client(host, grpc.credentials.createInsecure(), clientOptions);
        super(nodeClient, database, 'Ydb.Topic.V1.TopicService', Ydb.Topic.V1.TopicService, authService, sslCredentials, clientOptions);
        this.endpoint = endpoint;
        this.logger = logger;
    }

    // @ts-ignore
    public destroy();
    public /*async*/ destroy(ctx: Context) {
        let destroyPromise;
        if (this.allStreams.length > 0) {
            destroyPromise = new Promise((resolve) => {
                this.destroyResolve = resolve;
            });
            this.allStreams.forEach(s => {
                s.close(ctx)
            });
            this.allStreams = [];
        }
        return destroyPromise;
    }

    public async openWriteStreamWithEvents(ctx: Context, args: WriteStreamInitArgs & Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'messageGroupId'>) { // TODO: Why it's made thru symbols
        if (args.producerId === undefined || args.producerId === null) {
            const newGUID = uuid_v4();
            args = {...args, producerId: newGUID, messageGroupId: newGUID}
        } else if (args.messageGroupId === undefined || args.messageGroupId === null) {
            args = {...args, messageGroupId: args.producerId};
        }
        await this.updateMetadata();
        const writerStream = new TopicWriteStreamWithEvents(ctx, args, this, this.logger);
        // TODO: Use external writer
        writerStream.events.once('end', () => {
            const index = this.allStreams.findIndex(v => v === writerStream)
            if (index >= 0) this.allStreams.splice(index, 1);
            if (this.destroyResolve && this.allStreams.length === 0) this.destroyResolve(undefined);
        });
        this.allStreams.push(writerStream);
        return writerStream;
    }

    public async openReadStreamWithEvents(ctx: Context, args: ReadStreamInitArgs) {
        await this.updateMetadata(); // TODO: Check for update on every message
        const readStream = new TopicReadStreamWithEvents(ctx, args, this, this.logger);
        // TODO: Use external reader
        readStream.events.once('end', () => {
            const index = this.allStreams.findIndex(v => v === readStream)
            if (index >= 0) this.allStreams.splice(index, 1);
            if (this.destroyResolve && this.allStreams.length === 0) this.destroyResolve(undefined);
        });
        this.allStreams.push(readStream);
        return readStream;
    }

    public async commitOffset(_ctx: Context, request: CommitOffsetArgs) {
        return (await this.api.commitOffset(request)) as CommitOffsetResult;
    }

    public async updateOffsetsInTransaction(_ctx: Context, request: UpdateOffsetsInTransactionArgs) {
        return (await this.api.updateOffsetsInTransaction(request)) as UpdateOffsetsInTransactionResult;
    }

    public async createTopic(_ctx: Context, request: CreateTopicArgs) {
        return (await this.api.createTopic(request)) as CreateTopicResult;
    }

    public async describeTopic(_ctx: Context, request: DescribeTopicArgs) {
        return (await this.api.describeTopic(request)) as DescribeTopicResult;
    }

    public async describeConsumer(_ctx: Context, request: DescribeConsumerArgs) {
        return (await this.api.describeConsumer(request)) as DescribeConsumerResult;
    }

    public async alterTopic(_ctx: Context, request: AlterTopicArgs) {
        return (await this.api.alterTopic(request)) as AlterTopicResult;
    }

    public async dropTopic(_ctx: Context, request: DropTopicArgs) {
        return (await this.api.dropTopic(request)) as DropTopicResult;
    }
}
