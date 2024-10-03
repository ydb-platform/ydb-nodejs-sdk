import {
    TopicNodeClient,
    AlterTopicArgs, AlterTopicResult,
    CommitOffsetArgs, CommitOffsetResult,
    CreateTopicArgs, CreateTopicResult,
    DescribeConsumerArgs, DescribeConsumerResult,
    DescribeTopicArgs, DescribeTopicResult,
    DropTopicArgs, DropTopicResult,
    UpdateOffsetsInTransactionArgs, UpdateOffsetsInTransactionResult
} from "./internal/topic-node-client";
import EventEmitter from "events";
import {WriteStreamInitArgs} from "./internal/topic-write-stream-with-events";
import {ReadStreamInitArgs} from "./internal/topic-read-stream-with-events";
import {TopicWriter} from "./topic-writer";
import {Context, ensureContext} from "../context";
import {IClientSettings} from "../client/settings";
import {TopicReader} from "./topic-reader";
import {asIdempotentRetryableLambda} from "../retries/asIdempotentRetryableLambda";

export class TopicClient extends EventEmitter { // TODO: Reconsider why I need to have EventEmitter in any client
    private service?: TopicNodeClient;

    constructor(private settings: IClientSettings) {
        super();
    }

    /**
     * A temporary solution while a retrier is not in the place. That whould be a pool of services on different endpoins.
     */
    private async nextNodeService() {
        if (!this.service) this.service = await this.settings.discoveryService.getTopicNodeClient();
        await this.service.updateMetadata();
        return this.service!;
    }

    // @ts-ignore
    public destroy(): void;
    public destroy(_ctx: Context): void;
    @ensureContext(true)
    public async destroy(_ctx: Context): Promise<void> {
        // if (this.service) await this.service.destroy(); // TODO: service should be destroyed at the end
    }

    // @ts-ignore
    public createWriter(args: WriteStreamInitArgs): TopicWriter;
    public createWriter(ctx: Context, args: WriteStreamInitArgs): TopicWriter;
    @ensureContext(true)
    public async createWriter(ctx: Context, args: WriteStreamInitArgs) {
        if (args.getLastSeqNo === undefined) args = {...args, getLastSeqNo: true};
        return new TopicWriter(ctx, args, this.settings.retrier, this.settings.discoveryService, this.settings.logger);
    }

    // @ts-ignore
    public createReader(args: ReadStreamInitArgs): TopicReader;
    public createReader(ctx: Context, args: ReadStreamInitArgs): TopicReader;
    @ensureContext(true)
    public async createReader(ctx: Context, args: ReadStreamInitArgs) {
        return new TopicReader(ctx, args, this.settings.retrier, this.settings.discoveryService, this.settings.logger);
    }

    // TODO: Add commit a queue - same as in writer, to confirm commits

    // @ts-ignore
    public commitOffset(request: CommitOffsetArgs): Promise<CommitOffsetResult>;
    public commitOffset(ctx: Context, request: CommitOffsetArgs): Promise<CommitOffsetResult>;
    @ensureContext(true)
    // TODO: Add retryer
    public async commitOffset(ctx: Context, request: CommitOffsetArgs): Promise<CommitOffsetResult> {
        // if (!(typeof request.path === 'string' && request.path!.length > 0)) throw new Error('path is required');
        // if (!(typeof request.consumer === 'string' && request.consumer!.length > 0)) throw new Error('consumer is required');
        // if (!(typeof request.offset !== undefined && request.offset !== null)) throw new Error('offset is required');
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return /*await*/ asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).commitOffset(ctx, request);
            });
        });
    }

    // @ts-ignore
    public updateOffsetsInTransaction(request: UpdateOffsetsInTransactionArgs): Promise<UpdateOffsetsInTransactionResult>;
    public updateOffsetsInTransaction(ctx: Context, request: UpdateOffsetsInTransactionArgs): Promise<UpdateOffsetsInTransactionResult>;
    @ensureContext(true)
    public async updateOffsetsInTransaction(ctx: Context, request: UpdateOffsetsInTransactionArgs): Promise<UpdateOffsetsInTransactionResult> {
        // if (!(request.topics && request.topics.length > 0)) throw new Error('topics is required');
        // if (!(typeof request.consumer === 'string' && request.consumer!.length > 0)) throw new Error('consumer is required');
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return /*await*/ asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).updateOffsetsInTransaction(ctx, request);
            });
        });
    }

    // @ts-ignore
    public createTopic(request: CreateTopicArgs): Promise<CreateTopicResult>;
    public createTopic(ctx: Context, request: CreateTopicArgs): Promise<CreateTopicResult>;
    @ensureContext(true)
    public async createTopic(ctx: Context, request: CreateTopicArgs): Promise<CreateTopicResult> {
        // if (!(typeof request.path === 'string' && request.path!.length > 0)) throw new Error('path is required');
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return /*await*/ asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).createTopic(ctx, request);
            });
        });
    }

    // @ts-ignore
    public describeTopic(request: DescribeTopicArgs): Promise<DescribeTopicResult>;
    public describeTopic(ctx: Context, request: DescribeTopicArgs): Promise<DescribeTopicResult>;
    @ensureContext(true)
    public async describeTopic(ctx: Context, request: DescribeTopicArgs): Promise<DescribeTopicResult> {
        // if (!(typeof request.path === 'string' && request.path!.length > 0)) throw new Error('path is required');
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return /*await*/ asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).describeTopic(ctx, request);
            });
        });
    }

    // @ts-ignore
    public describeConsumer(request: DescribeConsumerArgs): Promise<DescribeConsumerResult>;
    public describeConsumer(ctx: Context, request: DescribeConsumerArgs): Promise<DescribeConsumerResult>;
    @ensureContext(true)
    public async describeConsumer(ctx: Context, request: DescribeConsumerArgs): Promise<DescribeConsumerResult> {
        // if (!(typeof request.path === 'string' && request.path!.length > 0)) throw new Error('path is required');
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return /*await*/ asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).describeConsumer(ctx, request);
            });
        });
    }

    // @ts-ignore
    public alterTopic(request: AlterTopicArgs): Promise<AlterTopicResult>;
    public alterTopic(ctx: Context, request: AlterTopicArgs): Promise<AlterTopicResult>;
    @ensureContext(true)
    public async alterTopic(ctx: Context, request: AlterTopicArgs): Promise<AlterTopicResult> {
        // if (!(typeof request.path === 'string' && request.path!.length > 0)) throw new Error('path is required');
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return /*await*/ asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).alterTopic(ctx, request);
            });
        });
    }

    // @ts-ignore
    public dropTopic(request: DropTopicArgs): Promise<DropTopicResult>;
    public dropTopic(ctx: Context, request: DropTopicArgs): Promise<DropTopicResult>;
    @ensureContext(true)
    public async dropTopic(ctx: Context, request: DropTopicArgs): Promise<DropTopicResult> {
        // if (!(typeof request.path === 'string' && request.path!.length > 0)) throw new Error('path is required');
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).dropTopic(ctx, request);
            });
        });
    }
}
