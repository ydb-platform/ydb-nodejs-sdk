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
import {ResultSet} from "./ResultSet";
import Long from "long";
import {ClientReadableStream} from "@grpc/grpc-js";
import {StatusObject as GrpcStatusObject} from "@grpc/grpc-js/build/src/call-interface";
import * as symbols from './symbols';
import ICreateSessionResult = Ydb.Table.ICreateSessionResult;
import ExecMode = Ydb.Query.ExecMode;
import IExecuteQueryRequest = Ydb.Query.IExecuteQueryRequest;
import IColumn = Ydb.IColumn;
import Syntax = Ydb.Query.Syntax;

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

type IExecuteResult = {
    resultSets: AsyncGenerator<ResultSet>,
};

export class QuerySession extends EventEmitter implements ICreateSessionResult {
    [symbols.sessionCurrentOperation]?: QuerySessionOperation;
    [symbols.sessionId]: string; // TODO: make public RO
    [symbols.sessionTxId]?: string; // TODO: make public RO
    private beingDeleted = false;
    private free = true;
    private closing = false;
    private attachStream?: ClientReadableStream<Ydb.Query.SessionState>;

    public get sessionId() {
        return this[symbols.sessionId];
    }

    public get txId() {
        return this[symbols.sessionTxId];
    }

    private constructor( // TODO: Change to named parameters for consistency
        private api: QueryService,
        private impl: SessionBuilder,
        public endpoint: Endpoint,
        sessionId: string,
        private logger: Logger,
        // TODO: Add timeout
    ) {
        super();
        this[symbols.sessionId] = sessionId;
    }

    static [symbols.create]( // TODO: Change to named parameters for consistency
        api: QueryService,
        impl: SessionBuilder,
        endpoint: Endpoint,
        sessionId: string,
        logger: Logger,
    ) {
        return new QuerySession(api, impl, endpoint, sessionId, logger);
    }

    [symbols.sessionAcquire]() {
        this.free = false;
        this.logger.debug(`Acquired session ${this.sessionId} on endpoint ${this.endpoint.toString()}.`);
        return this;
    }

    [symbols.sessionRelease]() {
        if (this[symbols.sessionCurrentOperation]) throw new Error('There is an active operation');
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
        if (this[symbols.sessionIsDeleted]()) return;
        this.beingDeleted = true;
        await this.attachStream?.cancel();
        delete this.attachStream; // only one stream cancel even when multi ple retries
        ensureCallSucceeded(await this.api.deleteSession({sessionId: this.sessionId}));
    }

    // TODO: Uncomment after switch to TS 5.3
    // [Symbol.asyncDispose]() {
    //     return this.delete();
    // }

    // public async attach(onStreamClosed: () => void) {
    public async [symbols.sessionAttach](onStreamClosed: () => void) {
        if (this.attachStream) throw new Error('Already attached');
        let connected = false;
        await this.impl.updateMetadata();
        return new Promise<void>((resolve, reject) => {
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
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                }
            });
            this.attachStream.on('metadata', (metadata) => {
                this.logger.trace('attach(): metadata: %o', metadata);
            });
            // TODO: Ensure that on-error always returns GrpcStatusObject
            this.attachStream.on('error', (err: Error & GrpcStatusObject) => {
                this.logger.trace('attach(): error: %o', err);
                if (connected) {
                    // delete this.attachStream; // uncomment when reattach policy will be implemented
                    onStreamClosed();
                } else {
                    reject(TransportError.convertToYdbError(err));
                }
            });
            this.attachStream.on('end', () => {
                this.logger.trace('attach(): end');
                // delete this.attachStream; // uncomment when reattach policy will be implemented
                onStreamClosed();
            });
        });
    }

    /**
     * Finishes when the first data block is received or when the end of the stream is received. So if you are sure
     * that the operation does not return any data, you may not process resultSets.
     */
    public execute(opts: {
        /**
         * SQL query / DDL etc.
         *
         */
        text: string,
        /**
         * Default value is SYNTAX_YQL_V1.
         */
        syntax?: Ydb.Query.Syntax,
        parameters?: { [k: string]: Ydb.ITypedValue },
        txControl?: Ydb.Query.ITransactionControl,
        execMode?: Ydb.Query.ExecMode,
        statsMode?: Ydb.Query.StatsMode,
        concurrentResultSets?: boolean,
        /**
         * Operation timeout in ms
         */
        timeout?: number,
        // rowMode: , // TODO: what returns ResultSet - ??? should it be here
    }): Promise<IExecuteResult> {
        // Validate opts
        if (!opts.text.trim()) throw new Error('"text" parameter is empty')
        if (opts.parameters)
            Object.keys(opts.parameters).forEach(n => {
                if (!n.startsWith('$')) throw new Error(`Parameter name must start with "$": ${n}`);
            })
        // TODO: No tx control in doTx
        // TODO: Send beingTx in first command in doTx
        if (opts.txControl?.txId) throw new Error('Cannot contain txControl.txId because the current session transaction is used (see session.txId)');
        if (this[symbols.sessionTxId]) {
            if (opts.txControl?.beginTx) throw new Error('txControl.beginTx when there\'s already an open transaction');
        } else {
            if (opts.txControl?.commitTx && !opts.txControl?.beginTx) throw new Error('txControl.commitTx === true when no open transaction and there\'s no txControl.beginTx');
        }

        // Build params
        const executeQueryRequest: IExecuteQueryRequest = {
            sessionId: this.sessionId,
            queryContent: {
                text: opts.text,
                syntax: opts.syntax ?? Syntax.SYNTAX_YQL_V1,
            },
            execMode: opts.execMode ?? ExecMode.EXEC_MODE_EXECUTE,
        };
        console.info(7000, opts.concurrentResultSets)
        if (opts.parameters) executeQueryRequest.parameters = opts.parameters;
        if (opts.statsMode) executeQueryRequest.statsMode = opts.statsMode; // TODO: Where stats goes?
        if (opts.txControl) executeQueryRequest.txControl = opts.txControl;
        executeQueryRequest.concurrentResultSets = opts.concurrentResultSets ?? false;
        if (this[symbols.sessionTxId])
            (executeQueryRequest.txControl || (executeQueryRequest.txControl = {})).txId = this[symbols.sessionTxId];

        // TODO: Update txId in the result
        console.info(3000, 'executeQueryRequest:', executeQueryRequest);

        // Run the operation
        let finished = false;
        const resultSetByIndex: [iterator: IAsyncQueueIterator<Ydb.IValue>, resultSet: ResultSet][] = [];
        const resultSetIterator = buildAsyncQueueIterator<ResultSet>();
        const concurrentResultSets = executeQueryRequest.concurrentResultSets;
        let lastRowsIterator: IAsyncQueueIterator<Ydb.IValue>;
        let resultResolve: ((data: IExecuteResult) => void) | undefined
        let resultReject: ((reason?: any) => void) | undefined;
        let responseStream: ClientReadableStream<Ydb.Query.ExecuteQueryResponsePart> | undefined;

        // Timeout if any
        const timeoutTimer =
            typeof opts.timeout === 'number' && opts.timeout > 0 ?
                setTimeout(() => {
                    cancel(new Error('Timeout is over'));
                }, opts.timeout)
                : undefined;

        // One operation per session in a time. And it might be cancelled
        if (this[symbols.sessionCurrentOperation]) throw new Error('There\'s another active operation in the session');

        const cancel = (reason: any, onStreamError?: boolean) => {
            if (finished) return;
            finished = true;
            if (onStreamError !== true) responseStream!.cancel();
            if (timeoutTimer) clearTimeout(timeoutTimer);
            if (resultReject) {
                resultReject(reason);
                resultResolve = resultReject = undefined;
            } else { // resultSet has already been returned to a client code
                resultSetIterator.error(reason);
                Object.values(resultSetByIndex).forEach(([iterator]) => {
                    iterator.error(reason);
                });
            }
            delete this[symbols.sessionCurrentOperation];
        }

        this[symbols.sessionCurrentOperation] = {cancel};

        // Operation
        responseStream = this.impl.grpcClient!.makeServerStreamRequest(
            Query_V1.ExecuteQuery,
            (v) => Ydb.Query.ExecuteQueryRequest.encode(v).finish() as Buffer,
            Ydb.Query.ExecuteQueryResponsePart.decode,
            Ydb.Query.ExecuteQueryRequest.create(executeQueryRequest),
            this.impl.metadata);

        responseStream.on('data', (partialResp: Ydb.Query.ExecuteQueryResponsePart) => {
            this.logger.trace('execute(): data: %o', partialResp);

            try {
                ensureCallSucceeded(partialResp);
            } catch (ydbErr) {
                return cancel(ydbErr);
            }

            // TODO: Process partial meta
            // TODO: Expect to see on graceful shutdown

            if (partialResp.resultSet) {

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
                        lastRowsIterator?.end();
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

                if (resultResolve) {
                    resultResolve({
                        resultSets: resultSetIterator[Symbol.asyncIterator](), // a list with first block already in it
                    });
                    resultResolve = resultReject = undefined;
                }
            }
        });

        responseStream.on('error', (err: Error & GrpcStatusObject) => {
            this.logger.trace('execute(): error: %o', err);
            if (err.code === 1) return; // skip "cancelled on client" error
            cancel(TransportError.convertToYdbError(err), true);
        });

        responseStream.on('end', () => {
            if (finished) return; // finished by cancel() - error or timeout. note: got to be before any logging, so Jest would not complain on logging after test end

            this.logger.trace('execute(): end');

            resultSetIterator.end();
            if (concurrentResultSets) {
                Object.values(resultSetByIndex).forEach(([iterator]) => {
                    iterator.end();
                });
            } else {
                lastRowsIterator?.end();
            }

            if (resultResolve) {
                resultResolve({
                    resultSets: resultSetIterator[Symbol.asyncIterator](), // an empty list
                });
                resultResolve = resultReject = undefined;
            }

            delete this[symbols.sessionCurrentOperation];
            finished = true;
        });

        return new Promise<IExecuteResult>((resolve, reject) => {
            resultResolve = resolve;
            resultReject = reject;
        })
    }
}
