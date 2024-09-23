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

export class TopicClient extends EventEmitter { // TODO: Reconsider why I need to have EventEmitter in any client
    private service?: TopicNodeClient;
    // private retrier: RetryStrategy;

    constructor(private settings: IClientSettings) {
        super();
        // this.retrier = new RetryStrategy(new RetryParameters({maxRetries: 0}), this.settings.logger);
    }

    /**
     * A temporary solution while a retrier is not in the place. That whould be a pool of services on different endpoins.
     */
    private async ensureService() {
        if (!this.service) {
            this.service = await this.settings.discoveryService.getTopicNodeClient();
        }
        this.settings.logger.debug('topic node client: %o', !!this.service);
        return this.service!;
    }

    public async destroy() {
        // if (this.service) await this.service.destroy(); // TODO: service should be destroyed at the end
    }

    // @ts-ignore
    public async createWriter(args:  WriteStreamInitArgs);
    @ensureContext(true)
    public async createWriter(ctx: Context, args:  WriteStreamInitArgs) {
        if (args.getLastSeqNo === undefined) args = {...args, getLastSeqNo: true};
        return new TopicWriter(ctx, args, this.settings.retrier, await this.ensureService(), this.settings.logger);
    }

    public async createReader(_args:  ReadStreamInitArgs) {
        // return new TopicReader(args, this.retrier, this.settings.discoveryService, this.logger);
    }

    public async commitOffset(request: CommitOffsetArgs): Promise<CommitOffsetResult> {
        if (!(typeof request.path === 'string' && request.path!.length > 0)) throw new Error('path is required');
        if (!(typeof request.consumer === 'string' && request.consumer!.length > 0)) throw new Error('consumer is required');
        if (!(typeof request.offset !== undefined && request.offset !== null)) throw new Error('offset is required');
        return /*await*/ (await this.ensureService()).commitOffset(request);
    }

    public async updateOffsetsInTransaction(request: UpdateOffsetsInTransactionArgs): Promise<UpdateOffsetsInTransactionResult> {
        if (!(request.topics && request.topics.length > 0)) throw new Error('topics is required');
        if (!(typeof request.consumer === 'string' && request.consumer!.length > 0)) throw new Error('consumer is required');
        return /*await*/ (await this.ensureService()).updateOffsetsInTransaction(request);
    }

    public async createTopic(request: CreateTopicArgs): Promise<CreateTopicResult> {
        if (!(typeof request.path === 'string' && request.path!.length > 0)) throw new Error('path is required');
        return /*await*/ (await this.ensureService()).createTopic(request);
    }

    public async describeTopic(request: DescribeTopicArgs): Promise<DescribeTopicResult> {
        if (!(typeof request.path === 'string' && request.path!.length > 0)) throw new Error('path is required');
        return /*await*/ (await this.ensureService()).describeTopic(request);
    }

    public async describeConsumer(request: DescribeConsumerArgs): Promise<DescribeConsumerResult> {
        if (!(typeof request.path === 'string' && request.path!.length > 0)) throw new Error('path is required');
        return /*await*/ (await this.ensureService()).describeConsumer(request);
    }

    public async alterTopic(request: AlterTopicArgs): Promise<AlterTopicResult> {
        if (!(typeof request.path === 'string' && request.path!.length > 0)) throw new Error('path is required');
        return /*await*/ (await this.ensureService()).alterTopic(request);
    }

    public async dropTopic(request: DropTopicArgs): Promise<DropTopicResult> {
        if (!(typeof request.path === 'string' && request.path!.length > 0)) throw new Error('path is required');
        return /*await*/ (await this.ensureService()).dropTopic(request);
    }
}
