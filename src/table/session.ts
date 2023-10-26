import EventEmitter from "events";
import * as grpc from "@grpc/grpc-js";
import {Ydb} from "ydb-sdk-proto";
import {Endpoint} from "../discovery";
import {Logger} from "../utils/simple-logger";
import {retryable} from "../retries";
import {AsyncResponse, ensureOperationSucceeded, getOperationPayload, pessimizable, StreamEnd} from "../utils";

import {MissingStatus, MissingValue, SchemeError, YdbError,} from '../errors';
import {ResponseMetadataKeys} from "../constants";
import {SessionEvent} from "./internal/sessionEvent";
import {PartialResponse} from "./internal/partialResponse";
import {IExistingTransaction} from "./internal/IExistingTransaction";
import {TableDescription} from "./tableDescription";
import {AlterTableDescription} from "./alterTableDescription";
import TableService = Ydb.Table.V1.TableService;
import ICreateSessionResult = Ydb.Table.ICreateSessionResult;
import IQuery = Ydb.Table.IQuery;
import DescribeTableResult = Ydb.Table.DescribeTableResult;
import PrepareQueryResult = Ydb.Table.PrepareQueryResult;
import ExecuteQueryResult = Ydb.Table.ExecuteQueryResult;
import ExplainQueryResult = Ydb.Table.ExplainQueryResult;
import ITransactionSettings = Ydb.Table.ITransactionSettings;
import BeginTransactionResult = Ydb.Table.BeginTransactionResult;
import ITransactionMeta = Ydb.Table.ITransactionMeta;
import ExecuteScanQueryPartialResult = Ydb.Table.ExecuteScanQueryPartialResult;
import TypedValue = Ydb.TypedValue;
import BulkUpsertResult = Ydb.Table.BulkUpsertResult;
import OperationMode = Ydb.Operations.OperationParams.OperationMode;
import {
    AlterTableSettings,
    BeginTransactionSettings,
    BulkUpsertSettings,
    CommitTransactionSettings,
    CreateTableSettings,
    DescribeTableSettings,
    DropTableSettings,
    ExecuteQuerySettings,
    ExecuteScanQuerySettings,
    PrepareQuerySettings,
    ReadTableSettings,
    RollbackTransactionSettings
} from "./settings";
import {ContextWithLogger} from "../context-with-logger";
import {NOT_A_CONTEXT} from "../utils/context";

interface INewTransaction {
    beginTx: ITransactionSettings,
    commitTx: boolean
}

export const AUTO_TX: INewTransaction = {
    beginTx: {
        serializableReadWrite: {}
    },
    commitTx: true
};

interface IQueryParams {
    [k: string]: Ydb.ITypedValue
}

export class Session extends EventEmitter implements ICreateSessionResult {
    private beingDeleted = false;
    private free = true;
    private closing = false;

    /**
     * ATTN: This field is updated through HACK every time session gets acquired.
     */
    // @ts-ignore
    readonly ctx: ContextWithLogger = NOT_A_CONTEXT;

    constructor(
        private api: TableService,
        public endpoint: Endpoint,
        public sessionId: string,
        private logger: Logger,
        private getResponseMetadata: (request: object) => grpc.Metadata | undefined
    ) {
        super();
    }

    acquire() {
        const ctx = ContextWithLogger.get('ydb_nodejs_sdk');
        this.free = false;
        (this as any).ctx = ctx;
        this.logger.debug(`Acquired session ${this.sessionId} on endpoint ${this.endpoint.toString()}.`);
        return this;
    }

    release() {
        this.free = true;
        (this as any).ctx = NOT_A_CONTEXT;
        this.logger.debug(`Released session ${this.sessionId} on endpoint ${this.endpoint.toString()}.`);
        this.emit(SessionEvent.SESSION_RELEASE, this);
    }

    public isFree() {
        return this.free && !this.isDeleted();
    }

    public isClosing() {
        return this.closing;
    }

    public isDeleted() {
        return this.beingDeleted;
    }

    @retryable()
    @pessimizable
    public async delete(): Promise<void> {
        if (this.isDeleted()) {
            return Promise.resolve();
        }
        this.beingDeleted = true;
        ensureOperationSucceeded(await this.api.deleteSession({sessionId: this.sessionId}));
    }

    @retryable()
    @pessimizable
    public async keepAlive(): Promise<void> {
        const request = {sessionId: this.sessionId};
        const response = await this.api.keepAlive(request);
        ensureOperationSucceeded(this.processResponseMetadata(request, response));
    }

    @retryable()
    @pessimizable
    public async createTable(
        tablePath: string,
        description: TableDescription,
        settings?: CreateTableSettings,
    ): Promise<void> {
        const request: Ydb.Table.ICreateTableRequest = {
            ...description,
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
        };

        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await this.api.createTable(request);
        ensureOperationSucceeded(this.processResponseMetadata(request, response));
    }

    @retryable()
    @pessimizable
    public async alterTable(
        tablePath: string,
        description: AlterTableDescription,
        settings?: AlterTableSettings
    ): Promise<void> {
        const request: Ydb.Table.IAlterTableRequest = {
            ...description,
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }

        const response = await this.api.alterTable(request);
        try {
            ensureOperationSucceeded(this.processResponseMetadata(request, response));
        } catch (error) {
            // !! does not returns response status if async operation mode
            if (request.operationParams?.operationMode !== OperationMode.SYNC && error instanceof MissingStatus) return;
            throw error;
        }
    }

    /*
     Drop table located at `tablePath` in the current database. By default dropping non-existent tables does not
     throw an error, to throw an error pass `new DropTableSettings({muteNonExistingTableErrors: true})` as 2nd argument.
     */
    @retryable()
    @pessimizable
    public async dropTable(tablePath: string, settings?: DropTableSettings): Promise<void> {
        const request: Ydb.Table.IDropTableRequest = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        settings = settings || new DropTableSettings();
        const suppressedErrors = settings?.muteNonExistingTableErrors ? [SchemeError.status] : [];
        const response = await this.api.dropTable(request);
        ensureOperationSucceeded(this.processResponseMetadata(request, response), suppressedErrors);
    }

    @retryable()
    @pessimizable
    public async describeTable(tablePath: string, settings?: DescribeTableSettings): Promise<DescribeTableResult> {
        const request: Ydb.Table.IDescribeTableRequest = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
            operationParams: settings?.operationParams,
        };

        if (settings) {
            request.includeTableStats = settings.includeTableStats;
            request.includeShardKeyBounds = settings.includeShardKeyBounds;
            request.includePartitionStats = settings.includePartitionStats;
            request.operationParams = settings.operationParams;
        }

        const response = await this.api.describeTable(request);
        const payload = getOperationPayload(this.processResponseMetadata(request, response));
        return DescribeTableResult.decode(payload);
    }

    @retryable()
    @pessimizable
    public async describeTableOptions(
        settings?: DescribeTableSettings,
    ): Promise<Ydb.Table.DescribeTableOptionsResult> {
        const request: Ydb.Table.IDescribeTableOptionsRequest = {
            operationParams: settings?.operationParams,
        };

        const response = await this.api.describeTableOptions(request);
        const payload = getOperationPayload(this.processResponseMetadata(request, response));
        return Ydb.Table.DescribeTableOptionsResult.decode(payload);
    }

    @retryable()
    @pessimizable
    public async beginTransaction(
        txSettings: ITransactionSettings,
        settings?: BeginTransactionSettings,
    ): Promise<ITransactionMeta> {
        const request: Ydb.Table.IBeginTransactionRequest = {
            sessionId: this.sessionId,
            txSettings,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await this.api.beginTransaction(request);
        const payload = getOperationPayload(this.processResponseMetadata(request, response));
        const {txMeta} = BeginTransactionResult.decode(payload);
        if (txMeta) {
            return txMeta;
        }
        throw new Error('Could not begin new transaction, txMeta is empty!');
    }

    @retryable()
    @pessimizable
    public async commitTransaction(txControl: IExistingTransaction, settings?: CommitTransactionSettings): Promise<void> {
        const request: Ydb.Table.ICommitTransactionRequest = {
            sessionId: this.sessionId,
            txId: txControl.txId,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
            request.collectStats = settings.collectStats;
        }
        const response = await this.api.commitTransaction(request);
        ensureOperationSucceeded(this.processResponseMetadata(request, response));
    }

    @retryable()
    @pessimizable
    public async rollbackTransaction(txControl: IExistingTransaction, settings?: RollbackTransactionSettings): Promise<void> {
        const request: Ydb.Table.IRollbackTransactionRequest = {
            sessionId: this.sessionId,
            txId: txControl.txId,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await this.api.rollbackTransaction(request);
        ensureOperationSucceeded(this.processResponseMetadata(request, response));
    }

    @retryable()
    @pessimizable
    public async prepareQuery(queryText: string, settings?: PrepareQuerySettings): Promise<PrepareQueryResult> {
        const request: Ydb.Table.IPrepareDataQueryRequest = {
            sessionId: this.sessionId,
            yqlText: queryText,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await this.api.prepareDataQuery(request);
        const payload = getOperationPayload(this.processResponseMetadata(request, response));
        return PrepareQueryResult.decode(payload);
    }

    @pessimizable
    public async executeQuery(
        query: PrepareQueryResult | string,
        params: IQueryParams = {},
        txControl: IExistingTransaction | INewTransaction = AUTO_TX,
        settings?: ExecuteQuerySettings,
    ): Promise<ExecuteQueryResult> {
        this.logger.trace('preparedQuery %o', query);
        this.logger.trace('parameters %o', params);
        let queryToExecute: IQuery;
        let keepInCache = false;
        if (typeof query === 'string') {
            queryToExecute = {
                yqlText: query
            };
            if (settings?.keepInCache !== undefined) {
                keepInCache = settings.keepInCache;
            }
        } else {
            queryToExecute = {
                id: query.queryId
            };
        }
        const request: Ydb.Table.IExecuteDataQueryRequest = {
            sessionId: this.sessionId,
            txControl,
            parameters: params,
            query: queryToExecute,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
            request.collectStats = settings.collectStats;
        }
        if (keepInCache) {
            request.queryCachePolicy = {keepInCache};
        }
        const response = await this.api.executeDataQuery(request);
        const payload = getOperationPayload(this.processResponseMetadata(request, response, settings?.onResponseMetadata));
        return ExecuteQueryResult.decode(payload);
    }

    private processResponseMetadata(
        request: object,
        response: AsyncResponse,
        onResponseMetadata?: (metadata: grpc.Metadata) => void
    ) {
        const metadata = this.getResponseMetadata(request);
        if (metadata) {
            const serverHints = metadata.get(ResponseMetadataKeys.ServerHints) || [];
            if (serverHints.includes('session-close')) {
                this.closing = true;
            }
            onResponseMetadata?.(metadata);
        }
        return response;
    }

    @pessimizable
    public async bulkUpsert(tablePath: string, rows: TypedValue, settings?: BulkUpsertSettings) {
        const request: Ydb.Table.IBulkUpsertRequest = {
            table: `${this.endpoint.database}/${tablePath}`,
            rows,
        };
        if (settings) {
            request.operationParams = settings.operationParams;
        }
        const response = await this.api.bulkUpsert(request);
        const payload = getOperationPayload(this.processResponseMetadata(request, response));
        return BulkUpsertResult.decode(payload);
    }

    @pessimizable
    public async streamReadTable(
        tablePath: string,
        consumer: (result: Ydb.Table.ReadTableResult) => void,
        settings?: ReadTableSettings): Promise<void> {
        const request: Ydb.Table.IReadTableRequest = {
            sessionId: this.sessionId,
            path: `${this.endpoint.database}/${tablePath}`,
        };
        if (settings) {
            request.columns = settings.columns;
            request.ordered = settings.ordered;
            request.rowLimit = settings.rowLimit;
            request.keyRange = settings.keyRange;
        }

        return this.executeStreamRequest(
            request,
            this.api.streamReadTable.bind(this.api),
            Ydb.Table.ReadTableResult.create,
            consumer);
    }

    @pessimizable
    public async streamExecuteScanQuery(
        query: PrepareQueryResult | string,
        consumer: (result: ExecuteScanQueryPartialResult) => void,
        params: IQueryParams = {},
        settings?: ExecuteScanQuerySettings): Promise<void> {
        let queryToExecute: IQuery;
        if (typeof query === 'string') {
            queryToExecute = {
                yqlText: query
            };
        } else {
            queryToExecute = {
                id: query.queryId
            };
        }

        const request: Ydb.Table.IExecuteScanQueryRequest = {
            query: queryToExecute,
            parameters: params,
            mode: settings?.mode || Ydb.Table.ExecuteScanQueryRequest.Mode.MODE_EXEC,
        };

        if (settings) {
            request.collectStats = settings.collectStats;
        }

        return this.executeStreamRequest(
            request,
            this.api.streamExecuteScanQuery.bind(this.api),
            ExecuteScanQueryPartialResult.create,
            consumer);
    }

    private executeStreamRequest<Req, Resp extends PartialResponse<IRes>, IRes, Res>(
        request: Req,
        apiStreamMethod: (request: Req, callback: (error: (Error | null), response?: Resp) => void) => void,
        transformer: (result: IRes) => Res,
        consumer: (result: Res) => void)
        : Promise<void> {
        return new Promise((resolve, reject) => {
            apiStreamMethod(request, (error, response) => {
                try {
                    if (error) {
                        if (error instanceof StreamEnd) {
                            resolve();
                        } else {
                            reject(error);
                        }
                    } else if (response) {
                        const operation = {
                            status: response.status,
                            issues: response.issues,
                        } as Ydb.Operations.IOperation;
                        YdbError.checkStatus(operation);

                        if (!response.result) {
                            reject(new MissingValue('Missing result value!'));
                            return;
                        }

                        const result = transformer(response.result);
                        consumer(result);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    public async explainQuery(query: string, operationParams?: Ydb.Operations.IOperationParams): Promise<ExplainQueryResult> {
        const request: Ydb.Table.IExplainDataQueryRequest = {
            sessionId: this.sessionId,
            yqlText: query,
            operationParams
        };
        const response = await this.api.explainDataQuery(request);
        const payload = getOperationPayload(this.processResponseMetadata(request, response));
        return ExplainQueryResult.decode(payload);
    }
}
