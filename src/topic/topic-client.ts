import EventEmitter from "events";
import {InternalWriteStreamInitArgs} from "./internal/internal-topic-write-stream";
import {InternalReadStreamInitArgs} from "./internal/internal-topic-read-stream";
import {TopicWriter} from "./topic-writer";
import {Context, ensureContext} from "../context";
import {IClientSettings} from "../client/settings";
import {TopicReader} from "./topic-reader";
import {asIdempotentRetryableLambda} from "../retries/asIdempotentRetryableLambda";
import {google, Ydb} from "ydb-sdk-proto";
import {InternalTopicClient} from "./internal/internal-topic-client";

// TODO: Consider support for "operationParams?: (Ydb.Operations.IOperationParams|null);". It presents in eve+ry jdbc operation

export type CommitOffsetArgs = {
    path: (string|null);
    partitionId?: (number|Long|null);
    consumer: (string|null);
    offset: (number|Long|null);
}
export type UpdateOffsetsInTransactionArgs = {
    operationParams?: (Ydb.Operations.IOperationParams|null);
    tx?: (Ydb.Topic.ITransactionIdentity|null);
    topics: Ydb.Topic.UpdateOffsetsInTransactionRequest.ITopicOffsets[];
    consumer: string;
}
export type CreateTopicArgs = {
    path: (string|null);
    partitioningSettings?: ({
        minActivePartitions?: (number|Long|null);
        partitionCountLimit?: (number|Long|null);
    }|null);
    retentionPeriod?: (google.protobuf.ITimestamp|null);
    retentionStorageMb?: (number|Long|null);
    supportedCodecs?: ({
        codecs?: (number[]|null);
    }|null);
    partitionWriteSpeedBytesPerSecond?: (number|Long|null);
    partitionWriteBurstBytes?: (number|Long|null);
    attributes?: ({ [k: string]: string }|null);
    consumers?: ({
        name?: (string|null);
        important?: (boolean|null);
        readFrom?: (google.protobuf.ITimestamp|null);
        supportedCodecs?: ({
            codecs?: (number[]|null);
        }|null);
        attributes?: ({ [k: string]: string }|null);
        consumerStats?: ({
            minPartitionsLastReadTime?: (google.protobuf.ITimestamp|null);
            maxReadTimeLag?: (google.protobuf.IDuration|null);
            maxWriteTimeLag?: (google.protobuf.IDuration|null);
            bytesRead?: ({
                perMinute?: (number|Long|null);
                perHour?: (number|Long|null);
                perDay?: (number|Long|null);
            }|null);
        }|null);
    }[]|null);
    meteringMode?: (Ydb.Topic.MeteringMode|null); // UNSPECIFIED, RESERVED_CAPACITY, REQUEST_UNITS
};
export type DescribeTopicArgs = {
    path: string;
    includeStats?: (boolean|null);
}
export type DescribeConsumerArgs = {
    path: string;
    consumer: string;
}
export type AlterTopicArgs = {
    path: string;
    alterPartitioningSettings?: ({
        setMinActivePartitions?: (number|Long|null);
        setPartitionCountLimit?: (number|Long|null);
    }|null);
    setRetentionPeriod?: (google.protobuf.IDuration|null);
    setRetentionStorageMb?: (number|Long|null);
    setSupportedCodecs?: ({
        codecs?: (number[]|null);
    }|null);
    setPartitionWriteSpeedBytesPerSecond?: (number|Long|null);
    setPartitionWriteBurstBytes?: (number|Long|null);
    alterAttributes?: ({ [k: string]: string }|null);
    addConsumers?: ({
        name?: (string|null);
        important?: (boolean|null);
        readFrom?: (google.protobuf.ITimestamp|null);
        supportedCodecs?: ({
            codecs?: (number[]|null);
        }|null);
        attributes?: ({ [k: string]: string }|null);
        consumerStats?: ({
            minPartitionsLastReadTime?: (google.protobuf.ITimestamp|null);
            maxReadTimeLag?: (google.protobuf.IDuration|null);
            maxWriteTimeLag?: (google.protobuf.IDuration|null);
            bytesRead?: ({
                perMinute?: (number|Long|null);
                perHour?: (number|Long|null);
                perDay?: (number|Long|null);
            }|null);
        }|null);
    }[]|null);
    dropConsumers?: (string[]|null);
    alterConsumers?: ({
        name: string;
        setImportant?: (boolean|null);
        setReadFrom?: (google.protobuf.ITimestamp|null);
        setSupportedCodecs?: ({
            codecs?: (number[]|null);
        }|null);
        alterAttributes?: ({ [k: string]: string }|null);
    }[]|null);
    setMeteringMode?: (Ydb.Topic.MeteringMode|null); // UNSPECIFIED, RESERVED_CAPACITY, REQUEST_UNITS

};
export type DropTopicArgs = {
    path: string;
};

export type OperationResult = {
    readonly operation?: ({
        readonly id?: (string|null);
        readonly ready?: (boolean|null);
        readonly status?: (Ydb.StatusIds.StatusCode|null);
        readonly issues?: (Ydb.Issue.IIssueMessage[]|null);
        readonly result?: (google.protobuf.IAny|null);
        readonly metadata?: (google.protobuf.IAny|null);
        readonly costInfo?: (Ydb.ICostInfo|null);
    }|null);
};

export class TopicClient extends EventEmitter { // TODO: Reconsider why I need to have EventEmitter in any client
    private service?: InternalTopicClient;

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
    public createWriter(args: InternalWriteStreamInitArgs): TopicWriter;
    public createWriter(ctx: Context, args: InternalWriteStreamInitArgs): TopicWriter;
    @ensureContext(true)
    public async createWriter(ctx: Context, args: InternalWriteStreamInitArgs) {
        if (args.getLastSeqNo === undefined) args = {...args, getLastSeqNo: true};
        return new TopicWriter(ctx, args, this.settings.retrier, this.settings.discoveryService, this.settings.logger);
    }

    // @ts-ignore
    public createReader(args: InternalReadStreamInitArgs): TopicReader;
    public createReader(ctx: Context, args: InternalReadStreamInitArgs): TopicReader;
    @ensureContext(true)
    public async createReader(ctx: Context, args: InternalReadStreamInitArgs) {
        return new TopicReader(ctx, args, this.settings.retrier, this.settings.discoveryService, this.settings.logger);
    }

    // TODO: Add commit a queue - same as in writer, to confirm commits

    // @ts-ignore
    public commitOffset(request: CommitOffsetArgs): Promise<OperationResult>;
    public commitOffset(ctx: Context, request: CommitOffsetArgs): Promise<OperationResult>;
    @ensureContext(true)
    // TODO: Add retryer
    public async commitOffset(ctx: Context, request: CommitOffsetArgs): Promise<OperationResult> {
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
    public updateOffsetsInTransaction(request: UpdateOffsetsInTransactionArgs): Promise<OperationResult>;
    public updateOffsetsInTransaction(ctx: Context, request: UpdateOffsetsInTransactionArgs): Promise<OperationResult>;
    @ensureContext(true)
    public async updateOffsetsInTransaction(ctx: Context, request: UpdateOffsetsInTransactionArgs): Promise<OperationResult> {
        // if (!(request.topics && request.topics.length > 0)) throw new Error('topics is required');
        // if (!(typeof request.consumer === 'string' && request.consumer!.length > 0)) throw new Error('consumer is required');
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return /*await*/ asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).updateOffsetsInTransaction(ctx, request);
            });
        });
    }

    // @ts-ignore
    public createTopic(request: CreateTopicArgs): Promise<OperationResult>;
    public createTopic(ctx: Context, request: CreateTopicArgs): Promise<OperationResult>;
    @ensureContext(true)
    public async createTopic(ctx: Context, request: CreateTopicArgs): Promise<OperationResult> {
        // if (!(typeof request.path === 'string' && request.path!.length > 0)) throw new Error('path is required');
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return /*await*/ asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).createTopic(ctx, request);
            });
        });
    }

    // @ts-ignore
    public describeTopic(request: DescribeTopicArgs): Promise<OperationResult>;
    public describeTopic(ctx: Context, request: DescribeTopicArgs): Promise<OperationResult>;
    @ensureContext(true)
    public async describeTopic(ctx: Context, request: DescribeTopicArgs): Promise<OperationResult> {
        // if (!(typeof request.path === 'string' && request.path!.length > 0)) throw new Error('path is required');
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return /*await*/ asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).describeTopic(ctx, request);
            });
        });
    }

    // @ts-ignore
    public describeConsumer(request: DescribeConsumerArgs): Promise<OperationResult>;
    public describeConsumer(ctx: Context, request: DescribeConsumerArgs): Promise<OperationResult>;
    @ensureContext(true)
    public async describeConsumer(ctx: Context, request: DescribeConsumerArgs): Promise<OperationResult> {
        // if (!(typeof request.path === 'string' && request.path!.length > 0)) throw new Error('path is required');
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return /*await*/ asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).describeConsumer(ctx, request);
            });
        });
    }

    // @ts-ignore
    public alterTopic(request: AlterTopicArgs): Promise<OperationResult>;
    public alterTopic(ctx: Context, request: AlterTopicArgs): Promise<OperationResult>;
    @ensureContext(true)
    public async alterTopic(ctx: Context, request: AlterTopicArgs): Promise<OperationResult> {
        // if (!(typeof request.path === 'string' && request.path!.length > 0)) throw new Error('path is required');
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return /*await*/ asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).alterTopic(ctx, request);
            });
        });
    }

    // @ts-ignore
    public dropTopic(request: DropTopicArgs): Promise<OperationResult>;
    public dropTopic(ctx: Context, request: DropTopicArgs): Promise<OperationResult>;
    @ensureContext(true)
    public async dropTopic(ctx: Context, request: DropTopicArgs): Promise<OperationResult> {
        // if (!(typeof request.path === 'string' && request.path!.length > 0)) throw new Error('path is required');
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).dropTopic(ctx, request);
            });
        });
    }
}
