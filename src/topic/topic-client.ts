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
import {IClientSettings} from "../table";
import EventEmitter from "events";
import {WriteStreamInitArgs} from "./internal/topic-write-stream-with-events";
import {TopicWriter} from "./topic-writer";

export class TopicClient extends EventEmitter { // TODO: Reconsider why I need to have EventEmitter in any client
    private service?: TopicNodeClient;

    constructor(private settings: IClientSettings) {
        super();
    }

    /**
     * A temporary solution while a retrier is not in the place. That whould be a pool of services on different endpoins.
     */
    private async ensureService() {
        if (!this.service) {
            this.service = await this.settings.discoveryService.getNextTopicNodeClient();
        }
        return this.service;
    }

    public async destroy() {
        if (this.service) await this.service.destroy();
    }

    public async createWriter(args: WriteStreamInitArgs) {
        return new TopicWriter(args, await (await this.ensureService()).openWriteStreamWithEvents(args));
    }

    public async commitOffset(request: CommitOffsetArgs): Promise<CommitOffsetResult> {
        return (await this.ensureService()).commitOffset(request);
    }

    public async updateOffsetsInTransaction(request: UpdateOffsetsInTransactionArgs): Promise<UpdateOffsetsInTransactionResult> {
        return (await this.ensureService()).updateOffsetsInTransaction(request);
    }

    public async createTopic(request: CreateTopicArgs): Promise<CreateTopicResult> {
        return (await this.ensureService()).createTopic(request);
    }

    public async describeTopic(request: DescribeTopicArgs): Promise<DescribeTopicResult> {
        return (await this.ensureService()).describeTopic(request);
    }

    public async describeConsumer(request: DescribeConsumerArgs): Promise<DescribeConsumerResult> {
        return (await this.ensureService()).describeConsumer(request);
    }

    public async alterTopic(request: AlterTopicArgs): Promise<AlterTopicResult> {
        return (await this.ensureService()).alterTopic(request);
    }

    public async dropTopic(request: DropTopicArgs): Promise<DropTopicResult> {
        return (await this.ensureService()).dropTopic(request);
    }
}
