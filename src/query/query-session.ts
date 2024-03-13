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
import {StatusObject as GrpcStatusObject} from "@grpc/grpc-js/build/src/call-interface";
import * as symbols from './symbols';

/**
 * Service methods, as they name in GRPC.
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

export interface QuerySessionOperation {
    cancel(reason: any): void;
}

export class QuerySession extends EventEmitter implements ICreateSessionResult {
    [symbols.sessionCurrentOperation]?: QuerySessionOperation;
    private beingDeleted = false;
    private free = true;
    private closing = false;
    private attachStream?: ClientReadableStream<Ydb.Query.SessionState>;
    [symbols.sessionTxId]?: string; // TODO: make public RO

    public get txId() {
        return this[symbols.sessionTxId];
    }


    constructor( // TODO: Change to named parameters for consistency
        private api: QueryService,
        private impl: SessionBuilder,
        public endpoint: Endpoint,
        public sessionId: string,
        private logger: Logger,
        // TODO: Add timeout
    ) {
        super();
    }

    [symbols.sessionAcquire]() {
        this.free = false;
        this.logger.debug(`Acquired session ${this.sessionId} on endpoint ${this.endpoint.toString()}.`);
        return this;
    }

    [symbols.sessionRelease]() {
        this.free = true;
        this.logger.debug(`Released session ${this.sessionId} on endpoint ${this.endpoint.toString()}.`);
        this.emit(SessionEvent.SESSION_RELEASE, this);
    }

    [symbols.sessionIsFree]() {
        return this.free && !this[symbols.sessionIsDeleted]();
    }

    [symbols.sessionIsClosing]() {
        return this.closing;
    }

    // TODO: Improve work with this.txId - transacti on may cover number of ops
    public async beginTransaction(txSettings: Ydb.Query.ITransactionSettings | null = null) {
        if (this[symbols.sessionTxId]) throw new Error('There is already opened transaction');
        const {txMeta} = ensureCallSucceeded(await this.api.beginTransaction({
            sessionId: this.sessionId,
            txSettings,
        }));
        if (this[symbols.sessionTxId]) throw new Error('Simultaneous beginTransaction() occurred');
        if (txMeta!.id) this[symbols.sessionTxId] = txMeta!.id;
    }

    public async commitTransaction() {
        if (!this[symbols.sessionTxId]) throw new Error('There is no an open transaction');
        try {
            return ensureCallSucceeded(await this.api.commitTransaction({
                sessionId: this.sessionId,
                txId: this[symbols.sessionTxId],
            }));
        } finally {
            delete this[symbols.sessionTxId];
        }
    }

    public async rollbackTransaction() {
        if (!this[symbols.sessionTxId]) throw new Error('There is no an open transaction');
        try {
            return ensureCallSucceeded(await this.api.rollbackTransaction({
                sessionId: this.sessionId,
                txId: this[symbols.sessionTxId],
            }));
        } finally {
            delete this[symbols.sessionTxId];
        }
    }

    public [symbols.sessionDeleteOnRelease]() {
        this.closing = true;
    }

    [symbols.sessionIsDeleted]() {
        return this.beingDeleted;
    }

    @retryable()
    @pessimizable
    public async delete(): Promise<void> {
        if (this[symbols.sessionIsDeleted]()) {
            return Promise.resolve();
        }
        this.beingDeleted = true;

        if (this.attachStream) {
            await this.attachStream.cancel();
            delete this.attachStream;
        }

        ensureCallSucceeded(await this.api.deleteSession({sessionId: this.sessionId}));
    }

    // public async attach(onStreamClosed: () => void) {
    public async [symbols.sessionAttach](onStreamClosed: () => void) {
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
        parameters?: { [k: string]: Ydb.ITypedValue },
        txControl?: Ydb.Query.ITransactionControl,
        execMode?: Ydb.Query.ExecMode,
        statsMode?: Ydb.Query.StatsMode,
        concurrentResultSets?: boolean,
        /**
         * Operation timeout in ms
         */
        timeout: number,
    }) {
        // Validate opts
        // TODO: No tx control in doTx
        if (opts.txControl?.txId) throw new Error('Cannot contain txControl.txId because the current session transaction is used (see session.txId)');
        if (this[symbols.sessionTxId]) {
            if (opts.txControl?.beginTx) throw new Error('txControl.beginTx when there\'s already an open transaction');
        } else {
            if (opts.txControl?.commitTx && !opts.txControl?.beginTx) throw new Error('txControl.commitTx === true when no open transaction and there\'s no txControl.beginTx');
        }

        // Build params
        const ExecuteQueryRequestParams: IExecuteQueryRequest = {
            sessionId: this.sessionId,
            queryContent: opts.queryContent,
            execMode: opts.execMode ?? ExecMode.EXEC_MODE_EXECUTE,
        };

        if (opts.parameters) ExecuteQueryRequestParams.parameters = opts.parameters;

        if (opts.statsMode) ExecuteQueryRequestParams.statsMode = opts.statsMode; // Where stats goes

        if (opts.txControl) ExecuteQueryRequestParams.txControl = opts.txControl;
        if (this[symbols.sessionTxId]) {
            (ExecuteQueryRequestParams.txControl || (ExecuteQueryRequestParams.txControl = {})).txId = this[symbols.sessionTxId];
        }

        // TODO: Update txId in the result

        ExecuteQueryRequestParams.concurrentResultSets = opts.concurrentResultSets ?? false;

        // Run operation
        let finished = false;
        const resultSetByIndex: [iterator: IAsyncQueueIterator<Ydb.IValue>, resultSet: ResultSet][] = [];
        const resultSetIterator = buildAsyncQueueIterator<ResultSet>();
        const concurrentResultSets = ExecuteQueryRequestParams.concurrentResultSets;
        let lastRowsIterator: IAsyncQueueIterator<Ydb.IValue>;

        // Timeout if any
        const timeoutTimer = opts.timeout > 0 ? setTimeout(() => { cancel(new Error('Timeout is over')); }, opts.timeout) : undefined;

        // One operation per session in a time. And it might be cancelled
        if ([symbols.sessionCurrentOperation]) throw new Error('There\'s another active operation in the session');
        function cancel(reason: any) {
            if (finished) return;
            finished = true;
            if (timeoutTimer) clearTimeout(timeoutTimer);
            resultSetIterator.error(reason);
            Object.values(resultSetByIndex).forEach(([iterator]) => {
                iterator.error(reason);
            });
        }
        this[symbols.sessionCurrentOperation] = {cancel};

        // Operation
        const responseStream = this.impl.grpcClient!.makeServerStreamRequest(
            Query_V1.ExecuteQuery,
            (v) => Ydb.Query.ExecuteQueryRequest.encode(v).finish() as Buffer,
            Ydb.Query.ExecuteQueryResponsePart.decode,
            Ydb.Query.ExecuteQueryRequest.create(ExecuteQueryRequestParams),
            this.impl.metadata);

        responseStream.on('data', (partialResp: Ydb.Query.ExecuteQueryResponsePart) => {
            this.logger.trace('execute(): data: %o', partialResp);

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

            // TODO: Process partial meta
            // TODO: Expect to see on graceful shutdown

            const _index = partialResp.resultSetIndex;
            const index = Long.isLong(_index) ? (_index as Long).toInt() : (resultSetByIndex as unknown as number);

            let iterator: IAsyncQueueIterator<Ydb.IValue>;
            let resultSet: ResultSet;

            let resultSetTuple = resultSetByIndex[index];
            if (!resultSetTuple) {
                iterator = buildAsyncQueueIterator<Ydb.IValue>();
                resultSet = ResultSet[symbols.create](index, partialResp.resultSet!.columns as IColumn[], iterator);
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
        });

        // responseStream.on('metadata', (metadata) => {
        //     this.logger.trace('execute(): metadata: %o', metadata);
        // });

        responseStream.on('end', () => {
            this.logger.trace('execute(): end');

            if (finished) return; // finished by cancel() - error or timeout

            resultSetIterator.end();
            if (concurrentResultSets) {
                Object.values(resultSetByIndex).forEach(([iterator]) => {
                    iterator.end();
                });
            } else {
                lastRowsIterator.end();
            }

            delete this[symbols.sessionCurrentOperation];
            finished = true;
        });

        responseStream.on('error', (err) => {
            this.logger.trace('execute(): error: %o', err);
            cancel(TransportError.convertToYdbError(err as Error & GrpcStatusObject));
        });

        // TODO: idempotent

        return {
            resultSets: resultSetIterator[Symbol.asyncIterator](),
        }
    }
}
