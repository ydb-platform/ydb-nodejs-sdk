import {Endpoint} from "../discovery";
import {Ydb} from "ydb-sdk-proto";

import {Logger} from "../logger/simple-logger";
import ICreateTopicResult = Ydb.Topic.ICreateTopicResult;
import {AuthenticatedService, ClientOptions} from "../utils";
import {IAuthService} from "../credentials/i-auth-service";
import {ISslCredentials} from "../utils/ssl-credentials";
import {TopicWriteStream, STREAM_DESTROYED, WriteStreamInitArgs} from "./topic-write-stream";
import {TopicReadStream, ReadStreamInitArgs} from "./topic-read-stream";

// TODO: Typed events
// TODO: Proper stream close/dispose and a reaction on end of stream from server
// TODO: Retries with the same options
// TODO: Batches
// TODO: Zip
// TODO: Sync queue
// TODO: Make as close as posible to pythone API
// TODO: Regular auth token update
// TODO: Graceful shutdown and close

// TODO: Ensure required props in args and results
type CommitOffsetArgs = Ydb.Topic.ICommitOffsetRequest & Required<Pick<Ydb.Topic.ICommitOffsetRequest, 'path'>>;
type CommitOffsetResult = Ydb.Topic.CommitOffsetResponse;

type UpdateOffsetsInTransactionArgs = Ydb.Topic.IUpdateOffsetsInTransactionRequest;
type UpdateOffsetsInTransactionResult = Ydb.Topic.UpdateOffsetsInTransactionResponse;

type CreateTopicArgs = Ydb.Topic.ICreateTopicRequest & Required<Pick<Ydb.Topic.ICreateTopicRequest, 'path'>>;
type CreateTopicResult = Ydb.Topic.CreateTopicResponse;

type DescribeTopicArgs = Ydb.Topic.IDescribeTopicRequest & Required<Pick<Ydb.Topic.IDescribeTopicRequest, 'path'>>;
type DescribeTopicResult = Ydb.Topic.DescribeTopicResponse;

type DescribeConsumerArgs =
    Ydb.Topic.IDescribeConsumerRequest
    & Required<Pick<Ydb.Topic.IDescribeConsumerRequest, 'path'>>;
type DescribeConsumerResult = Ydb.Topic.DescribeConsumerResponse;

type AlterTopicArgs = Ydb.Topic.IAlterTopicRequest & Required<Pick<Ydb.Topic.IAlterTopicRequest, 'path'>>;
type AlterTopicResult = Ydb.Topic.AlterTopicResponse;

type DropTopicArgs = Ydb.Topic.IDropTopicRequest & Required<Pick<Ydb.Topic.IDropTopicRequest, 'path'>>;
type DropTopicResult = Ydb.Topic.DropTopicResponse;

export class TopicService extends AuthenticatedService<Ydb.Topic.V1.TopicService> implements ICreateTopicResult {
    public endpoint: Endpoint;
    private readonly logger: Logger;
    private allStreams: { dispose(): void }[] = [];

    constructor(endpoint: Endpoint, database: string, authService: IAuthService, logger: Logger, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions) {
        const host = endpoint.toString();
        super(host, database, 'Ydb.Topic.V1.TopicService', Ydb.Topic.V1.TopicService, authService, sslCredentials, clientOptions);
        this.endpoint = endpoint;
        this.logger = logger;
    }

    public dispose() {
        const streams = this.allStreams;
        this.allStreams = [];
        streams.forEach(s => {
            s.dispose()
        });
    }

    public async openWriteStream(opts: WriteStreamInitArgs) {
        await this.updateMetadata(); // TODO: Check for update on every message
        const writerStream = new TopicWriteStream(opts, this, this.logger);
        writerStream.events.once(STREAM_DESTROYED, (stream: { dispose: () => {} }) => {
            const index = this.allStreams.findIndex(v => v === stream)
            if (index >= 0) this.allStreams.splice(index, 1);
        });
        this.allStreams.push(writerStream); // TODO: Is is possible to have multiple streams in a time? I.e. while server errors
        return writerStream;
    }

    public async openReadStream(opts: ReadStreamInitArgs) {
        await this.updateMetadata(); // TODO: Check for update on every message
        const readStream = new TopicReadStream(opts, this, this.logger);
        readStream.events.once(STREAM_DESTROYED, (stream: { dispose: () => {} }) => {
            const index = this.allStreams.findIndex(v => v === stream)
            if (index >= 0) this.allStreams.splice(index, 1);
        });
        this.allStreams.push(readStream); // TODO: Is is possible to have multiple streams in a time? I.e. while server errors
        return readStream;
    }

    public async commitOffset(request: CommitOffsetArgs) {
        return (await this.api.commitOffset(request)) as CommitOffsetResult;
    }

    public async updateOffsetsInTransaction(request: UpdateOffsetsInTransactionArgs) {
        return (await this.api.updateOffsetsInTransaction(request)) as UpdateOffsetsInTransactionResult;
    }

    public async createTopic(request: CreateTopicArgs) {
        return (await this.api.createTopic(request)) as CreateTopicResult;
    }

    public async describeTopic(request: DescribeTopicArgs) {
        return (await this.api.describeTopic(request)) as DescribeTopicResult;
    }

    public async describeConsumer(request: DescribeConsumerArgs) {
        return (await this.api.describeConsumer(request)) as DescribeConsumerResult;
    }

    public async alterTopic(request: AlterTopicArgs) {
        return (await this.api.alterTopic(request)) as AlterTopicResult;
    }

    public async dropTopic(request: DropTopicArgs) {
        return (await this.api.dropTopic(request)) as DropTopicResult;
    }
}
