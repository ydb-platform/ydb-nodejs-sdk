import {Endpoint} from "../discovery";
import {Ydb} from "ydb-sdk-proto";

import {Logger} from "../logger/simple-logger";
import ICreateTopicResult = Ydb.Topic.ICreateTopicResult;
import {AuthenticatedService, ClientOptions} from "../utils";
import {IAuthService} from "../credentials/i-auth-service";
import {ISslCredentials} from "../utils/ssl-credentials";
import {InternalTopicWrite, InternalTopicWriteOpts} from "./internal-topic-write";

type GrpcTopicService = Ydb.Topic.V1.TopicService;

/**
 * Service methods, as they name in GRPC.
 */
export const enum Query_V1 {
    // ExecuteQuery = '/Ydb.Query.V1.QueryService/ExecuteQuery',
}

export interface QuerySessionOperation {
    cancel(reason: any): void;
}

export const grpcApiSymbol = Symbol('api');
export const implSymbol = Symbol('impl');
export const attachStreamSymbol = Symbol('attachStream');

// TODO: Ensure required props in args and results
type CommitOffsetArgs =  Ydb.Topic.ICommitOffsetRequest & Required<Pick<Ydb.Topic.ICommitOffsetRequest, 'path'>>;
type CommitOffsetResult = Ydb.Topic.CommitOffsetResponse;

type UpdateOffsetsInTransactionArgs = Ydb.Topic.IUpdateOffsetsInTransactionRequest;
type UpdateOffsetsInTransactionResult = Ydb.Topic.UpdateOffsetsInTransactionResponse;

type CreateTopicArgs = Ydb.Topic.ICreateTopicRequest & Required<Pick<Ydb.Topic.ICreateTopicRequest, 'path'>>;;
type CreateTopicResult = Ydb.Topic.CreateTopicResponse;

type DescribeTopicArgs = Ydb.Topic.IDescribeTopicRequest & Required<Pick<Ydb.Topic.IDescribeTopicRequest, 'path'>>;;
type DescribeTopicResult = Ydb.Topic.DescribeTopicResponse;

type DescribeConsumerArgs = Ydb.Topic.IDescribeConsumerRequest & Required<Pick<Ydb.Topic.IDescribeConsumerRequest, 'path'>>;;
type DescribeConsumerResult = Ydb.Topic.DescribeConsumerResponse;

type AlterTopicArgs = Ydb.Topic.IAlterTopicRequest & Required<Pick<Ydb.Topic.IAlterTopicRequest, 'path'>>;;
type AlterTopicResult = Ydb.Topic.AlterTopicResponse;

type DropTopicArgs = Ydb.Topic.IDropTopicRequest & Required<Pick<Ydb.Topic.IDropTopicRequest, 'path'>>;;
type DropTopicResult = Ydb.Topic.DropTopicResponse;


export class InternalTopicService extends AuthenticatedService<GrpcTopicService> implements ICreateTopicResult {
    public endpoint: Endpoint;
    private readonly logger: Logger;

    constructor(endpoint: Endpoint, database: string, authService: IAuthService, logger: Logger, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions) {
        const host = endpoint.toString();
        super(host, database, 'Ydb.Topic.V1.TopicService', GrpcTopicService, authService, sslCredentials, clientOptions);
        this.endpoint = endpoint;
        this.logger = logger;
    }

    public async streamWrite(opts: InternalTopicWriteOpts) {
        await this.updateMetadata();
        return new InternalTopicWrite(this, this.logger, opts);
    }


    // public streamWrite(request: Ydb.Topic.StreamWriteMessage.IFromClient): Promise<Ydb.Topic.StreamWriteMessage.FromServer>;
    //
    // public streamRead(request: Ydb.Topic.StreamReadMessage.IFromClient): Promise<Ydb.Topic.StreamReadMessage.FromServer>;

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
