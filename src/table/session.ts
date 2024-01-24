import {google, Ydb} from "ydb-sdk-proto";
import ITransactionSettings = Ydb.Table.ITransactionSettings;
import BeginTransactionResult = Ydb.Table.BeginTransactionResult;
import ITransactionMeta = Ydb.Table.ITransactionMeta;
export import OperationMode = Ydb.Operations.OperationParams.OperationMode;
import EventEmitter from "events";
import {Endpoint} from "../discovery";
import {Logger} from "../logging";
import * as grpc from "@grpc/grpc-js";
import {SessionEvent} from "./session-pool";
import {retryable} from "../retries";
import {AsyncResponse, ensureOperationSucceeded, getOperationPayload, pessimizable, StreamEnd} from "../utils";
import {ResponseMetadataKeys} from "../constants";
import {MissingValue, YdbError} from "../errors";

export interface IExistingTransaction {
    txId: string
}

export interface INewTransaction {
    beginTx: ITransactionSettings,
    commitTx: boolean
}

export const AUTO_TX: INewTransaction = {
    beginTx: {
        serializableReadWrite: {}
    },
    commitTx: true
};

interface PartialResponse<T> {
    status?: (Ydb.StatusIds.StatusCode|null);
    issues?: (Ydb.Issue.IIssueMessage[]|null);
    result?: (T|null);
}

export class OperationParams implements Ydb.Operations.IOperationParams {
    operationMode?: OperationMode;
    operationTimeout?: google.protobuf.IDuration;
    cancelAfter?: google.protobuf.IDuration;
    labels?: { [k: string]: string };
    reportCostInfo?: Ydb.FeatureFlag.Status;

    withSyncMode() {
        this.operationMode = OperationMode.SYNC;
        return this;
    }

    withAsyncMode() {
        this.operationMode = OperationMode.ASYNC;
        return this;
    }

    withOperationTimeout(duration: google.protobuf.IDuration) {
        this.operationTimeout = duration;
        return this;
    }

    withOperationTimeoutSeconds(seconds: number) {
        this.operationTimeout = {seconds};
        return this;
    }

    withCancelAfter(duration: google.protobuf.IDuration) {
        this.cancelAfter = duration;
        return this;
    }

    withCancelAfterSeconds(seconds: number) {
        this.cancelAfter = {seconds};
        return this;
    }

    withLabels(labels: { [k: string]: string }) {
        this.labels = labels;
        return this;
    }

    withReportCostInfo() {
        this.reportCostInfo = Ydb.FeatureFlag.Status.ENABLED;
        return this;
    }
}

export class OperationParamsSettings {
    operationParams?: OperationParams;

    withOperationParams(operationParams: OperationParams) {
        this.operationParams = operationParams;
        return this;
    }
}

export class BeginTransactionSettings extends OperationParamsSettings {
}

export class CommitTransactionSettings extends OperationParamsSettings {
    collectStats?: Ydb.Table.QueryStatsCollection.Mode;

    withCollectStats(collectStats: Ydb.Table.QueryStatsCollection.Mode) {
        this.collectStats = collectStats;
        return this;
    }
}

export class RollbackTransactionSettings extends OperationParamsSettings {
}

export interface ServiceWithSessionsAndTransactions extends EventEmitter {
    createSession(request: Ydb.Table.ICreateSessionRequest): Promise<Ydb.Table.CreateSessionResponse>;
    deleteSession(request: Ydb.Table.IDeleteSessionRequest): Promise<Ydb.Table.DeleteSessionResponse>;
    keepAlive?(request: Ydb.Table.IKeepAliveRequest): Promise<Ydb.Table.KeepAliveResponse>;

    beginTransaction(request: Ydb.Table.IBeginTransactionRequest): Promise<Ydb.Table.BeginTransactionResponse>;
    commitTransaction(request: Ydb.Table.ICommitTransactionRequest): Promise<Ydb.Table.CommitTransactionResponse>;
    rollbackTransaction(request: Ydb.Table.IRollbackTransactionRequest): Promise<Ydb.Table.RollbackTransactionResponse>;
}

export interface SessionCreator<SessionType extends Session<any>> {
    create(): Promise<SessionType>;
}

export class Session<ServiceType extends ServiceWithSessionsAndTransactions> extends EventEmitter implements Ydb.Table.ICreateSessionResult {
    private beingDeleted = false;
    private free = true;
    private closing = false;

    constructor(protected api: ServiceType, public endpoint: Endpoint, public sessionId: string, protected logger: Logger, protected getResponseMetadata: (request: object) => grpc.Metadata | undefined) {
        super();
    }

    acquire() {
        this.free = false;
        this.logger.debug(`Acquired session ${this.sessionId} on endpoint ${this.endpoint.toString()}.`);
        return this;
    }

    release() {
        this.free = true;
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
        if (typeof this.api.keepAlive !== 'function') {
            throw new Error('This service does not support keep alive method');
        }
        const request = {sessionId: this.sessionId};
        const response = await this.api.keepAlive(request);
        ensureOperationSucceeded(this.processResponseMetadata(request, response));
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

    protected processResponseMetadata(
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

    protected executeStreamRequest<Req, Resp extends PartialResponse<IRes>, IRes, Res>(
        request: Req,
        apiStreamMethod: (request: Req, callback: (error: (Error|null), response?: Resp) => void) => void,
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
}
