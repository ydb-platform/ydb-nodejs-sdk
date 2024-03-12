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
import Long from "long";
import IColumn = Ydb.IColumn;
import {ClientReadableStream} from "@grpc/grpc-js";
import SessionState = Ydb.Query.SessionState;

// TODO: Commit open tx on .do end
// TODO: assign txId from session during tx

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

        if (this.attachStream) {
            await this.attachStream.cancel();
            delete this.attachStream;
        }

        ensureCallSucceeded(await this.api.deleteSession({sessionId: this.sessionId}));
    }

    private attachStream?: ClientReadableStream<SessionState>;

    public async attach(onStreamClosed: () => void) {
        // TODO: Check attached
        let connected = false;
        await this.impl.updateMetadata();
        return new Promise((resolve, reject) => {
            this.attachStream = this.impl.grpcClient!.makeServerStreamRequest(
                Query_V1.AttachSession,
                (v) => Ydb.Query.AttachSessionRequest.encode(v).finish() as Buffer,
                Ydb.Query.SessionState.decode,
                Ydb.Query.AttachSessionRequest.create({sessionId: this.sessionId}),
                this.impl.metadata);
            this.attachStream.on('data', (partialResp: Ydb.Query.SessionState) => {
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
            this.attachStream.on('end', () => {
                this.logger.debug('attach(): end');
                delete this.attachStream;
                onStreamClosed();
            });
            this.attachStream.on('error', (err) => {
                this.logger.debug('attach(): error: %o', err);
                console.info(3000, err)
                if (TransportError.isMember(err)) err = TransportError.convertToYdbError(err);
                console.info(3100, err)
                if (connected) {
                    delete this.attachStream;
                    onStreamClosed();
                } else {
                    reject(err);
                }
            });
        });
    }

    public execute(opts: {
        // TODO: split
        queryContent: IQueryContent,
        execMode?: Ydb.Query.ExecMode,
        // TODO: Ensure sequential calls
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
        ExecuteQueryRequestParams.concurrentResultSets = opts.concurrentResultSets ?? false;

        const resultSetByIndex: [iterator: IAsyncQueueIterator<Ydb.IValue>, resultSet: ResultSet][] = [];
        const resultSetIterator = buildAsyncQueueIterator<ResultSet>();
        const concurrentResultSets = ExecuteQueryRequestParams.concurrentResultSets;
        let lastRowsIterator: IAsyncQueueIterator<Ydb.IValue>;

        const responseStream = this.impl.grpcClient!.makeServerStreamRequest(
            Query_V1.ExecuteQuery,
            (v) => Ydb.Query.ExecuteQueryRequest.encode(v).finish() as Buffer,
            Ydb.Query.ExecuteQueryResponsePart.decode,
            Ydb.Query.ExecuteQueryRequest.create(ExecuteQueryRequestParams),
            this.impl.metadata);

        responseStream.on('data', (partialResp: Ydb.Query.ExecuteQueryResponsePart) => {
            try {
                // console.info(7000, partialResp);
                ensureCallSucceeded(partialResp);
            } catch (ydbErr) {
                resultSetIterator.error(ydbErr as Error);
                console.info(7100, ydbErr);
                Object.values(resultSetByIndex).forEach(([iterator]) => {
                    iterator.error(ydbErr as Error);
                });
            }

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
                if (!concurrentResultSets) {
                    lastRowsIterator.end();
                    lastRowsIterator = iterator;
                }
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
            resultSetIterator.end();
            if (concurrentResultSets) {
                Object.values(resultSetByIndex).forEach(([iterator]) => {
                    iterator.end();
                });
            } else {
                lastRowsIterator.end();
            }
        });

        responseStream.on('error', (err) => {
            // TODO: Should wrap transport error?
            this.logger.debug('execute(): error: %o', err);

            // TODO: required: Error & GrpcStatusObject
            // const transportErr = TransportError.convertToYdbError(err);
            const transportErr = err;

            resultSetIterator.error(transportErr);
            Object.values(resultSetByIndex).forEach(([iterator]) => {
                iterator.error(transportErr);
            });
        });

        // TODO: where tx comes from
        // TODO: single exec in a time
        // TODO: idempotent

        return {
            resultSets: resultSetIterator[Symbol.asyncIterator](),
        }
    }
}
