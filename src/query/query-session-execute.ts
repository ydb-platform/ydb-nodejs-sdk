import {Ydb} from "ydb-sdk-proto";
import * as symbols from "./symbols";
import {buildAsyncQueueIterator, IAsyncQueueIterator} from "../utils/build-async-queue-iterator";
import {ResultSet} from "./ResultSet";
import {ClientReadableStream} from "@grpc/grpc-js";
import {ensureCallSucceeded} from "../utils/process-ydb-operation-result";
import Long from "long";
import {StatusObject as GrpcStatusObject} from "@grpc/grpc-js/build/src/call-interface";
import {TransportError} from "../errors";
import {impl, logger, Query_V1, QuerySession} from "./query-session";
import IExecuteQueryRequest = Ydb.Query.IExecuteQueryRequest;
import IColumn = Ydb.IColumn;

export type IExecuteResult = {
    resultSets: AsyncGenerator<ResultSet>,
    execStats?: Ydb.TableStats.IQueryStats;
};

/**
 * Finishes when the first data block is received or when the end of the stream is received. So if you are sure
 * that the operation does not return any data, you may not process resultSets.
 */
export function execute(this: QuerySession, opts: {
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
    // idempotent: , // TODO: Keep in session, was there an non-idempotent opеration
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
            syntax: opts.syntax ?? Ydb.Query.Syntax.SYNTAX_YQL_V1,
        },
        execMode: opts.execMode ?? Ydb.Query.ExecMode.EXEC_MODE_EXECUTE,
    };
    if (opts.parameters) executeQueryRequest.parameters = opts.parameters;
    if (opts.statsMode) executeQueryRequest.statsMode = opts.statsMode; // TODO: Where stats goes?
    if (opts.txControl) executeQueryRequest.txControl = opts.txControl;
    executeQueryRequest.concurrentResultSets = opts.concurrentResultSets ?? false;
    if (this[symbols.sessionTxId])
        (executeQueryRequest.txControl || (executeQueryRequest.txControl = {})).txId = this[symbols.sessionTxId];

// Run the operation
    let finished = false;
    const resultSetByIndex: [iterator: IAsyncQueueIterator<Ydb.IValue>, resultSet: ResultSet][] = [];
    const resultSetIterator = buildAsyncQueueIterator<ResultSet>();
    const concurrentResultSets = executeQueryRequest.concurrentResultSets;
    let lastRowsIterator: IAsyncQueueIterator<Ydb.IValue>;
    let resultResolve: ((data: IExecuteResult) => void) | undefined
    let resultReject: ((reason?: any) => void) | undefined;
    let responseStream: ClientReadableStream<Ydb.Query.ExecuteQueryResponsePart> | undefined;
    let execStats: Ydb.TableStats.IQueryStats | undefined;


// Timeout if any
    // TODO: Change to ctx.withTimout once Context will be finished
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
    responseStream = this[impl].grpcClient!.makeServerStreamRequest(
        Query_V1.ExecuteQuery,
        (v) => Ydb.Query.ExecuteQueryRequest.encode(v).finish() as Buffer,
        Ydb.Query.ExecuteQueryResponsePart.decode,
        Ydb.Query.ExecuteQueryRequest.create(executeQueryRequest),
        this[impl].metadata);

    responseStream.on('data', (partialResp: Ydb.Query.ExecuteQueryResponsePart) => {
        this[logger].trace('execute(): data: %o', partialResp);

        try {
            ensureCallSucceeded(partialResp);
        } catch (ydbErr) {
            return cancel(ydbErr);
        }

        if (partialResp.txMeta?.id)
            this[symbols.sessionTxId] = partialResp.txMeta!.id;
        else
            delete this[symbols.sessionTxId];

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

            if (resultResolve) {
                resultResolve({
                    resultSets: resultSetIterator[Symbol.asyncIterator](), // a list with first block already in it
                    get execStats() {
                        return execStats
                    },
                });
                resultResolve = resultReject = undefined;
            }
        }

        if (partialResp.execStats) {
            execStats = partialResp.execStats;
        }

        partialResp.txMeta

    });

    responseStream.on('error', (err: Error & GrpcStatusObject) => {
        this[logger].trace('execute(): error: %o', err);
        if (err.code === 1) return; // skip "cancelled" error
        cancel(TransportError.convertToYdbError(err), true);
    });

    responseStream.on('metadata', (_metadata) => {
        // TODO: Process partial meta
        // TODO: Expect to see on graceful shutdown
    });

    responseStream.on('end', () => {
        if (finished) return; // finished by cancel() - error or timeout. note: got to be before any logging, so Jest would not complain on logging after test end

        this[logger].trace('execute(): end');

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
                get execStats() {
                    return execStats
                },
            });
            resultResolve = resultReject = undefined;
        }

        delete this[symbols.sessionCurrentOperation];
        finished = true;
    });

    return new Promise<IExecuteResult>((resolve, reject) => {
        resultResolve = resolve;
        resultReject = reject;
    });
}
