import {Endpoint} from "../../discovery";
import {Ydb} from "ydb-sdk-proto";

import {Logger} from "../../logger/simple-logger";
import ICreateTopicResult = Ydb.Topic.ICreateTopicResult;
import {AuthenticatedService, ClientOptions} from "../../utils";
import {IAuthService} from "../../credentials/i-auth-service";
import {ISslCredentials} from "../../utils/ssl-credentials";
import {InternalTopicWriteStream, InternalWriteStreamInitArgs} from "./internal-topic-write-stream";
import {InternalTopicReadStream, InternalReadStreamInitArgs} from "./internal-topic-read-stream";
import {v4 as uuid_v4} from 'uuid';
import {Context} from "../../context";
import * as grpc from "@grpc/grpc-js";

// TODO: Retries with the same options
// TODO: Batches
// TODO: Zip compression
// TODO: Graceful shutdown and close

export type InternalCommitOffsetArgs =
    Ydb.Topic.ICommitOffsetRequest
    & Required<Pick<Ydb.Topic.ICommitOffsetRequest, 'path' | 'consumer' | 'offset'>>;
export type InternalCommitOffsetResult = Readonly<Ydb.Topic.CommitOffsetResponse>;

export type InternalUpdateOffsetsInTransactionArgs =
    Ydb.Topic.IUpdateOffsetsInTransactionRequest
    & Required<Pick<Ydb.Topic.UpdateOffsetsInTransactionRequest, 'topics' | 'consumer'>>;
export type InternalUpdateOffsetsInTransactionResult = Readonly<Ydb.Topic.UpdateOffsetsInTransactionResponse>;

export type InternalCreateTopicArgs = Ydb.Topic.ICreateTopicRequest & Required<Pick<Ydb.Topic.ICreateTopicRequest, 'path'>>;
export type InternalCreateTopicResult = Readonly<Ydb.Topic.CreateTopicResponse>;

export type InternalDescribeTopicArgs =
    Ydb.Topic.IDescribeTopicRequest
    & Required<Pick<Ydb.Topic.IDescribeTopicRequest, 'path'>>;
export type InternalDescribeTopicResult = Readonly<Ydb.Topic.DescribeTopicResponse>;

export type InternalDescribeConsumerArgs =
    Ydb.Topic.IDescribeConsumerRequest
    & Required<Pick<Ydb.Topic.IDescribeConsumerRequest, 'path' | 'consumer'>>;
export type InternalDescribeConsumerResult = Readonly<Ydb.Topic.DescribeConsumerResponse>;

export type InternalAlterTopicArgs = Ydb.Topic.IAlterTopicRequest & Required<Pick<Ydb.Topic.IAlterTopicRequest, 'path'>>;
export type InternalAlterTopicResult = Readonly<Ydb.Topic.AlterTopicResponse>
export type InternalDropTopicArgs = Ydb.Topic.IDropTopicRequest & Required<Pick<Ydb.Topic.IDropTopicRequest, 'path'>>;
export type InternalDropTopicResult = Readonly<Ydb.Topic.DropTopicResponse>;

export class InternalTopicClient extends AuthenticatedService<Ydb.Topic.V1.TopicService> implements ICreateTopicResult {
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

    public async openWriteStreamWithEvents(ctx: Context, args: InternalWriteStreamInitArgs & Pick<Ydb.Topic.StreamWriteMessage.IInitRequest, 'messageGroupId'>) {
        if (args.producerId === undefined || args.producerId === null) {
            const newGUID = uuid_v4();
            args = {...args, producerId: newGUID, messageGroupId: newGUID}
        } else if (args.messageGroupId === undefined || args.messageGroupId === null) {
            args = {...args, messageGroupId: args.producerId};
        }
        const writerStream = new InternalTopicWriteStream(ctx, args, this, this.logger);
        writerStream.events.once('end', () => {
            const index = this.allStreams.findIndex(v => v === writerStream)
            if (index >= 0) this.allStreams.splice(index, 1);
            if (this.destroyResolve && this.allStreams.length === 0) this.destroyResolve(undefined);
        });
        this.allStreams.push(writerStream);
        return writerStream;
    }

    public async openReadStreamWithEvents(ctx: Context, args: InternalReadStreamInitArgs) {
        const readStream = new InternalTopicReadStream(ctx, args, this, this.logger);
        readStream.events.once('end', () => {
            const index = this.allStreams.findIndex(v => v === readStream)
            if (index >= 0) this.allStreams.splice(index, 1);
            if (this.destroyResolve && this.allStreams.length === 0) this.destroyResolve(undefined);
        });
        this.allStreams.push(readStream);
        return readStream;
    }

    public async commitOffset(_ctx: Context, request: InternalCommitOffsetArgs) {
        return (await this.api.commitOffset(request)) as InternalCommitOffsetResult;
    }

    public async updateOffsetsInTransaction(_ctx: Context, request: InternalUpdateOffsetsInTransactionArgs) {
        return (await this.api.updateOffsetsInTransaction(request)) as InternalUpdateOffsetsInTransactionResult;
    }

    public async createTopic(_ctx: Context, request: InternalCreateTopicArgs) {
        return (await this.api.createTopic(request)) as InternalCreateTopicResult;
    }

    public async describeTopic(_ctx: Context, request: InternalDescribeTopicArgs) {
        return (await this.api.describeTopic(request)) as InternalDescribeTopicResult;
    }

    public async describeConsumer(_ctx: Context, request: InternalDescribeConsumerArgs) {
        return (await this.api.describeConsumer(request)) as InternalDescribeConsumerResult;
    }

    public async alterTopic(_ctx: Context, request: InternalAlterTopicArgs) {
        return (await this.api.alterTopic(request)) as InternalAlterTopicResult;
    }

    public async dropTopic(_ctx: Context, request: InternalDropTopicArgs) {
        return (await this.api.dropTopic(request)) as InternalDropTopicResult;
    }
}
