import {TopicWriter} from "./topic-writer";
import {Context, ensureContext} from "../context";
import {IClientSettings} from "../client/settings";
import {TopicReader} from "./topic-reader";
import {asIdempotentRetryableLambda} from "../retries/asIdempotentRetryableLambda";
import {google, Ydb} from "ydb-sdk-proto";
import {InternalTopicClient} from "./internal/internal-topic-client";

// TODO: Consider support for "operationParams?: (Ydb.Operations.IOperationParams|null);". It presents in every jdbc operation

export type ICreateWriterArgs = {
    path: string;
    producerId?: (string|null);
    writeSessionMeta?: ({ [k: string]: string }|null);
    messageGroupId?: (string|null);
    partitionId?: (number|Long|null);
    getLastSeqNo?: (boolean|null);
}
export type ICreateReaderArgs = {
    receiveBufferSizeInBytes: number;
    topicsReadSettings: {
        path: string;
        partitionIds?: ((number|Long)[]|null);
        maxLag?: (google.protobuf.IDuration|null);
        readFrom?: (google.protobuf.ITimestamp|null);
    }[];
    consumer?: (string|null);
    readerName?: (string|null);
}
export type ICommitOffsetArgs = {
    path: (string|null);
    partitionId?: (number|Long|null);
    consumer: (string|null);
    offset: (number|Long|null);
}
export type IUpdateOffsetsInTransactionArgs = {
    operationParams?: (Ydb.Operations.IOperationParams|null);
    tx?: (Ydb.Topic.ITransactionIdentity|null);
    topics: Ydb.Topic.UpdateOffsetsInTransactionRequest.ITopicOffsets[];
    consumer: string;
}
export type ICreateTopicArgs = {
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
export type IDescribeTopicArgs = {
    path: string;
    includeStats?: (boolean|null);
}
export type IDescribeConsumerArgs = {
    path: string;
    consumer: string;
}
export type IAlterTopicArgs = {
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
export type IDropTopicArgs = {
    path: string;
};

export type IOperationResult = {
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

export class TopicClient {
    private service?: InternalTopicClient;

    constructor(private settings: IClientSettings) {
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
        // TODO: Close opened readers and writers
    }

    // @ts-ignore
    public createWriter(args: ICreateWriterArgs): TopicWriter;
    public createWriter(ctx: Context, args: ICreateWriterArgs): TopicWriter;
    @ensureContext(true)
    public async createWriter(ctx: Context, args: ICreateWriterArgs) {
        if (args.getLastSeqNo === undefined) args = {...args, getLastSeqNo: true};
        return new TopicWriter(ctx, args, this.settings.retrier, this.settings.discoveryService, this.settings.logger);
    }

    // @ts-ignore
    public createReader(args: ICreateReaderArgs): TopicReader;
    public createReader(ctx: Context, args: ICreateReaderArgs): TopicReader;
    @ensureContext(true)
    public async createReader(ctx: Context, args: ICreateReaderArgs) {
        return new TopicReader(ctx, args, this.settings.retrier, this.settings.discoveryService, this.settings.logger);
    }

    // TODO: Add commit queue - same as in writer, to confirm commits

    // @ts-ignore
    public commitOffset(request: ICommitOffsetArgs): Promise<IOperationResult>;
    public commitOffset(ctx: Context, request: ICommitOffsetArgs): Promise<IOperationResult>;
    @ensureContext(true)
    public async commitOffset(ctx: Context, request: ICommitOffsetArgs): Promise<IOperationResult> {
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return /*await*/ asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).commitOffset(ctx, request);
            });
        });
    }

    // @ts-ignore
    public updateOffsetsInTransaction(request: IUpdateOffsetsInTransactionArgs): Promise<IOperationResult>;
    public updateOffsetsInTransaction(ctx: Context, request: IUpdateOffsetsInTransactionArgs): Promise<IOperationResult>;
    @ensureContext(true)
    public async updateOffsetsInTransaction(ctx: Context, request: IUpdateOffsetsInTransactionArgs): Promise<IOperationResult> {
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return /*await*/ asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).updateOffsetsInTransaction(ctx, request);
            });
        });
    }

    // @ts-ignore
    public createTopic(request: ICreateTopicArgs): Promise<IOperationResult>;
    public createTopic(ctx: Context, request: ICreateTopicArgs): Promise<IOperationResult>;
    @ensureContext(true)
    public async createTopic(ctx: Context, request: ICreateTopicArgs): Promise<IOperationResult> {
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return /*await*/ asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).createTopic(ctx, request);
            });
        });
    }

    // @ts-ignore
    public describeTopic(request: IDescribeTopicArgs): Promise<IOperationResult>;
    public describeTopic(ctx: Context, request: IDescribeTopicArgs): Promise<IOperationResult>;
    @ensureContext(true)
    public async describeTopic(ctx: Context, request: IDescribeTopicArgs): Promise<IOperationResult> {
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return /*await*/ asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).describeTopic(ctx, request);
            });
        });
    }

    // @ts-ignore
    public describeConsumer(request: IDescribeConsumerArgs): Promise<IOperationResult>;
    public describeConsumer(ctx: Context, request: IDescribeConsumerArgs): Promise<IOperationResult>;
    @ensureContext(true)
    public async describeConsumer(ctx: Context, request: IDescribeConsumerArgs): Promise<IOperationResult> {
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return /*await*/ asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).describeConsumer(ctx, request);
            });
        });
    }

    // @ts-ignore
    public alterTopic(request: IAlterTopicArgs): Promise<IOperationResult>;
    public alterTopic(ctx: Context, request: IAlterTopicArgs): Promise<IOperationResult>;
    @ensureContext(true)
    public async alterTopic(ctx: Context, request: IAlterTopicArgs): Promise<IOperationResult> {
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return /*await*/ asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).alterTopic(ctx, request);
            });
        });
    }

    // @ts-ignore
    public dropTopic(request: IDropTopicArgs): Promise<IOperationResult>;
    public dropTopic(ctx: Context, request: IDropTopicArgs): Promise<IOperationResult>;
    @ensureContext(true)
    public async dropTopic(ctx: Context, request: IDropTopicArgs): Promise<IOperationResult> {
        return this.settings.retrier.retry(ctx, /*async*/ () => {
            return asIdempotentRetryableLambda(async () => {
                return /*await*/ (await this.nextNodeService()).dropTopic(ctx, request);
            });
        });
    }
}
