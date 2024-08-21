import {
    AlterTopicArgs,
    CommitOffsetArgs,
    CreateTopicArgs, DescribeConsumerArgs,
    DescribeTopicArgs, DropTopicArgs,
    TopicService,
    UpdateOffsetsInTransactionArgs
} from "./topic-service";
import {IClientSettings} from "../table";
import EventEmitter from "events";
import {WriteStreamInitArgs} from "./topic-write-stream-with-events";
import {TopicWriter} from "./topic-writer";
import {openWriteStreamWithEvents} from "./symbols";

export class TopicClient extends EventEmitter { // TODO: Reconsider why I need to have EventEmitter in any client
    private service?: TopicService;

    constructor(private settings: IClientSettings) {
        super();
    }

    /**
     * A temporary solution while a retrier is not in the place. That whould be a pool of services on different endpoins.
     */
    private async ensureService() {
        if (!this.service) this.service = new TopicService(
            await this.settings.discoveryService.getEndpoint(),
            this.settings.database,
            this.settings.authService,
            this.settings.logger,
            this.settings.sslCredentials,
            this.settings.clientOptions,
        );
        return this.service;
    }

    public async destroy() {
        if (this.service) await this.service.destroy();
    }

    public async createWriter(opts: WriteStreamInitArgs) {
        return new TopicWriter(await (await this.ensureService())[openWriteStreamWithEvents](opts));
    }

    public async commitOffset(request: CommitOffsetArgs) {
        return (await this.ensureService()).commitOffset(request);
    }

    public async updateOffsetsInTransaction(request: UpdateOffsetsInTransactionArgs) {
        return (await this.ensureService()).updateOffsetsInTransaction(request);
    }

    public async createTopic(request: CreateTopicArgs) {
        return (await this.ensureService()).createTopic(request);
    }

    public async describeTopic(request: DescribeTopicArgs) {
        return (await this.ensureService()).describeTopic(request);
    }

    public async describeConsumer(request: DescribeConsumerArgs) {
        return (await this.ensureService()).describeConsumer(request);
    }

    public async alterTopic(request: AlterTopicArgs) {
        return (await this.ensureService()).alterTopic(request);
    }

    public async dropTopic(request: DropTopicArgs) {
        return (await this.ensureService()).dropTopic(request);
    }
}
