import EventEmitter from "events";
import {QueryService, SessionBuilder, SessionEvent} from "./query-session-pool";
import {Endpoint} from "../discovery";
import {Logger} from "../logging";
import {retryable} from "../retries";
import {pessimizable} from "../utils";
import {ensureCallSucceeded} from "../utils/process-ydb-operation-result";
import {Ydb} from "ydb-sdk-proto";
import {TransportError} from "../errors";
import {buildAsyncQueueIterator, IAsyncQueueIterator} from "../utils/build-async-queue-iterator";
import ICreateSessionResult = Ydb.Table.ICreateSessionResult;
import IQueryContent = Ydb.Query.IQueryContent;
import ExecMode = Ydb.Query.ExecMode;
import IExecuteQueryRequest = Ydb.Query.IExecuteQueryRequest;
import {ResultSet} from "./ResultSet";
import IType = Ydb.IType;
import Long from "long";
import IColumn = Ydb.IColumn;

/**
 * Service methods, as they used in GRPC.
 */
const enum Query_V1 {
    CreateSession = '/Ydb.Query.V1.QueryService/CreateSession',
    DeleteSession = '/Ydb.Query.V1.QueryService/DeleteSession',
    AttachSession = '/Ydb.Query.V1.QueryService/AttachSession',
    BeginTransaction = '/Ydb.Query.V1.QueryService/BeginTransaction',
    CommitTransaction = '/Ydb.Query.V1.QueryService/CommitTransaction',
    RollbackTransaction = '/Ydb.Query.V1.QueryService/RollbackTransaction',
    ExecuteQuery = '/Ydb.Query.V1.QueryService/ExecuteQuery',
    ExecuteScript = '/Ydb.Query.V1.QueryService/ExecuteScript',
    FetchScriptResults = '/Ydb.Query.V1.QueryService/FetchScriptResults',
}

export class QuerySession extends EventEmitter implements ICreateSessionResult {
    private beingDeleted = false;
    private free = true;
    private closing = false;
    private txId?: string;

    constructor(
        private api: QueryService,
        private impl: SessionBuilder,
        public endpoint: Endpoint,
        public sessionId: string,
        private logger: Logger,
        // private getResponseMetadata: (request: object) => grpc.Metadata | undefined
    ) {
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

    // TODO: Improve work with this.txId - transacti on may cover number of ops
    public async beginTransaction(txSettings: Ydb.Query.ITransactionSettings | null = null) {
        if (this.txId) throw new Error('There is already opened transaction');
        const {txMeta} = ensureCallSucceeded(await this.api.beginTransaction({
            sessionId: this.sessionId,
            txSettings,
        }));
        if (this.txId) throw new Error('Simultaneous beginTransaction() occurred');
        this.txId = txMeta!.id!;
    }

    public async commitTransaction() {
        if (!this.txId) throw new Error('There is no an open transaction');
        try {
            return ensureCallSucceeded(await this.api.commitTransaction({
                sessionId: this.sessionId,
                txId: this.txId,
            }));
        } finally {
            delete this.txId;
        }
    }

    public async rollbackTransaction() {
        if (!this.txId) throw new Error('There is no an open transaction');
        try {
            return ensureCallSucceeded(await this.api.rollbackTransaction({
                sessionId: this.sessionId,
                txId: this.txId,
            }));
        } finally {
            delete this.txId;
        }
    }

    public deleteOnRelease() {
        this.closing = true;
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
        ensureCallSucceeded(await this.api.deleteSession({sessionId: this.sessionId}));
    }


    public async attach(onStreamClosed: () => void) {
        // TODO: Check attached
        let connected = false;
        await this.impl.updateMetadata();
        return new Promise((resolve, reject) => {
            const responseStream = this.impl.grpcClient!.makeServerStreamRequest(
                Query_V1.AttachSession,
                (v) => Ydb.Query.AttachSessionRequest.encode(v).finish() as Buffer,
                Ydb.Query.SessionState.decode,
                Ydb.Query.AttachSessionRequest.create({sessionId: this.sessionId}),
                this.impl.metadata);
            responseStream.on('data', (partialResp: Ydb.Query.SessionState) => {
                this.logger.debug('attach(): data: %o', partialResp);
                if (!connected) {
                    connected = true;
                    try {
                        ensureCallSucceeded(partialResp);
                        resolve(undefined);
                    } catch (err) {
                        reject(err);
                    }
                }
            })
            responseStream.on('metadata', (metadata) => {
                this.logger.debug('attach(): metadata: %o', metadata);

            });
            responseStream.on('end', () => {
                this.logger.debug('attach(): end');
                onStreamClosed();
            });
            responseStream.on('error', (err) => {
                this.logger.debug('attach(): error: %o', err);
                if (TransportError.isMember(err)) err = TransportError.convertToYdbError(err);
                if (connected) {
                    onStreamClosed();
                } else {
                    reject(err);
                }
            });
        });
    }

    public execute(opts: {
        queryContent: IQueryContent,
        execMode?: Ydb.Query.ExecMode,
        txControl?: Ydb.Query.ITransactionControl,
        parameters?: { [k: string]: Ydb.ITypedValue },
        statsMode?: Ydb.Query.StatsMode,
        concurrentResultSets?: boolean,
    }) {
        const ExecuteQueryRequestParams: IExecuteQueryRequest = {
            sessionId: this.sessionId,
            queryContent: opts.queryContent,
            execMode: opts.execMode ?? ExecMode.EXEC_MODE_EXECUTE,
        };
        if (opts.txControl) ExecuteQueryRequestParams.txControl = opts.txControl;
        if (opts.parameters) ExecuteQueryRequestParams.parameters = opts.parameters;
        if (opts.statsMode) ExecuteQueryRequestParams.statsMode = opts.statsMode; // Where stats goes
        if (opts.concurrentResultSets) ExecuteQueryRequestParams.concurrentResultSets = opts.concurrentResultSets; // TODO: Impl

        const resultSetByIndex: [iterator: IAsyncQueueIterator<Ydb.IValue>, resultSet: ResultSet][] = [];
        const resultSetIterator = buildAsyncQueueIterator<ResultSet>();

        const responseStream = this.impl.grpcClient!.makeServerStreamRequest(
            Query_V1.ExecuteQuery,
            (v) => Ydb.Query.ExecuteQueryRequest.encode(v).finish() as Buffer,
            Ydb.Query.ExecuteQueryResponsePart.decode,
            Ydb.Query.ExecuteQueryRequest.create(ExecuteQueryRequestParams),
            this.impl.metadata);

        responseStream.on('data', (partialResp: Ydb.Query.ExecuteQueryResponsePart) => {
            // TODO: Check error
            this.logger.debug('execute(): data: %o', partialResp);

            const _index = partialResp.resultSetIndex;
            const index = Long.isLong(_index) ? (_index as Long).toInt() : (resultSetByIndex as unknown as number);

            let iterator: IAsyncQueueIterator<Ydb.IValue>;
            let resultSet: ResultSet;

            let resultSetTuple = resultSetByIndex[index];
            if (!resultSetTuple) {
                iterator = buildAsyncQueueIterator<Ydb.IValue>();
                resultSet = new ResultSet(index, partialResp.resultSet!.columns as IColumn[], iterator);
                resultSetIterator.push(resultSet);
                resultSetByIndex[index] = [iterator, resultSet];
            } else {
                [iterator, resultSet] = resultSetTuple;
            }

            for (const row of partialResp.resultSet!.rows!) {
                iterator.push(row);
            }

            if (partialResp.execStats) {
                resultSet.execStats = partialResp.execStats;
            }

            // TODO: Process partial meta
        });

        responseStream.on('metadata', (metadata) => {
            // TODO: Expect to see on graceful shutdown
            this.logger.debug('execute(): metadata: %o', metadata);
        });

        responseStream.on('end', () => {
            this.logger.debug('execute(): end');

        });

        responseStream.on('error', (err) => {
            // TODO: Should wrap transport error?
            this.logger.debug('execute(): error: %o', err);

            resultSetIterator.error(err);
            resultSetByIndex.forEach(([iterator]) => {
                iterator.error(err);
            });
        });

        return {
            resultSets: resultSetIterator[Symbol.asyncIterator](),
        }
    }
}
