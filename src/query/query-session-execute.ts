import { Ydb } from "ydb-sdk-proto";
import {
    isIdempotentDoLevelSymbol,
    isIdempotentSymbol,
    resultsetYdbColumnsSymbol,
    sessionCurrentOperationSymbol,
    sessionTrailerCallbackSymbol,
    sessionTxIdSymbol,
    sessionTxSettingsSymbol,
} from "./symbols";
import { buildAsyncQueueIterator, IAsyncQueueIterator } from "../utils/build-async-queue-iterator";
import { ResultSet } from "./result-set";
import { ClientReadableStream } from "@grpc/grpc-js";
import { ensureCallSucceeded } from "../utils/process-ydb-operation-result";
import Long from "long";
import { StatusObject as GrpcStatusObject } from "@grpc/grpc-js/build/src/call-interface";
import { TransportError } from "../errors";
import { implSymbol, QuerySession } from "./query-session";
import { convertYdbValueToNative, snakeToCamelCaseConversion } from "../types";
import { CtxUnsubcribe } from "../context";
import IExecuteQueryRequest = Ydb.Query.IExecuteQueryRequest;
import IColumn = Ydb.IColumn;

export type IExecuteArgs = {
    /**
     * SQL query / DDL etc.
     *
     */
    text: string,
    /**
     * Default value is SYNTAX_YQL_V1.
     */
    syntax?: Ydb.Query.Syntax,
    /**
     * SQL query parameters.
     */
    parameters?: { [k: string]: Ydb.ITypedValue },
    txControl?: Ydb.Query.ITransactionControl,
    execMode?: Ydb.Query.ExecMode,
    statsMode?: Ydb.Query.StatsMode,
    concurrentResultSets?: boolean,
    /**
     * Operation timeout in ms
     */
    // timeout?: number, // TODO: that make sense to timeout one op?
    /**
     * Default Native.
     */
    rowMode?: RowType,
    idempotent?: boolean,

    /**
     * Resource Pool
     *
     * @deprecated Use resourcePool.
     */
    poolId?: string,

    /**
     * Resource Pool
     *
     * CREATE RESOURCE POOL pool_name WITH (...)
     */
    resourcePool?: string,
};

export type IExecuteResult = {
    resultSets: AsyncGenerator<ResultSet>,
    execStats?: Ydb.TableStats.IQueryStats;
    /**
     * Gets resolved when all data is received from stream and execute() operation become completed. At that moment
     * is allowed to start next operation within session.
     *
     * Wait for this promise is equivalent to get read all data from all result sets.
     */
    opFinished: Promise<void>;
    idempotent?: boolean;
};

export const CANNOT_MANAGE_TRASACTIONS_ERROR = 'Cannot manage transactions at the session level if do() has the txSettings parameter or doTx() is used';

export const enum RowType {
    /**
     * Received rows get converted to js native format according to rules from src/types.ts.
     */
    Native,

    /**
     * As it is received from GRPC buffer.  Required to use TypedData<T> in ResultSet.
     */
    Ydb,
}

/**
 * Finishes when the first data block is received or when the end of the stream is received. So if you are sure
 * that the operation does not return any data, you may not process resultSets.
 */
export function execute(this: QuerySession, args: IExecuteArgs): Promise<IExecuteResult> {
    // Validate args
    if (!args.text.trim()) throw new Error('"text" parameter is empty')
    if (args.parameters)
        Object.keys(args.parameters).forEach(n => {
            if (!n.startsWith('$')) throw new Error(`Parameter name must start with "$": ${n}`);
        })
    if (args.txControl && this[sessionTxSettingsSymbol])
        throw new Error(CANNOT_MANAGE_TRASACTIONS_ERROR);
    if (args.txControl?.txId)
        throw new Error('Cannot contain txControl.txId because the current session transaction is used (see session.txId)');
    if (this[sessionTxIdSymbol]) {
        if (args.txControl?.beginTx)
            throw new Error('txControl.beginTx when there\'s already an open transaction');
    } else {
        if (args.txControl?.commitTx && !args.txControl?.beginTx)
            throw new Error('txControl.commitTx === true when no open transaction and there\'s no txControl.beginTx');
    }

    // Build params
    const executeQueryRequest: IExecuteQueryRequest = {
        sessionId: this.sessionId,
        queryContent: {
            text: args.text,
            syntax: args.syntax ?? Ydb.Query.Syntax.SYNTAX_YQL_V1,
        },
        execMode: args.execMode ?? Ydb.Query.ExecMode.EXEC_MODE_EXECUTE,
        poolId: args.poolId ?? args.resourcePool,
    };
    if (args.statsMode) executeQueryRequest.statsMode = args.statsMode;
    if (args.parameters) executeQueryRequest.parameters = args.parameters;
    if (this[sessionTxSettingsSymbol] && !this[sessionTxIdSymbol])
        executeQueryRequest.txControl = { beginTx: this[sessionTxSettingsSymbol], commitTx: false };
    else if (args.txControl)
        executeQueryRequest.txControl = args.txControl;
    if (this[sessionTxIdSymbol])
        (executeQueryRequest.txControl || (executeQueryRequest.txControl = {})).txId = this[sessionTxIdSymbol];
    executeQueryRequest.concurrentResultSets = args.concurrentResultSets ?? false;
    if (args.hasOwnProperty('idempotent')) {
        if (this[isIdempotentDoLevelSymbol]) throw new Error('The attribute of idempotency is already set at the level of do()');
        if (args.idempotent) this[isIdempotentSymbol] = true;
    }

    // Run the operation
    let finished = false;
    const resultSetByIndex: [iterator: IAsyncQueueIterator<Ydb.IValue>, resultSet: ResultSet][] = [];
    const resultSetIterator = buildAsyncQueueIterator<ResultSet>();
    const concurrentResultSets = executeQueryRequest.concurrentResultSets;
    let lastRowsIterator: IAsyncQueueIterator<Ydb.IValue>;
    let resultResolve: ((data: IExecuteResult) => void) | undefined
    let resultReject: ((reason?: any) => void) | undefined;
    let finishedResolve: (() => void) | undefined;
    let finishedReject: ((reason?: any) => void) | undefined;
    let responseStream: ClientReadableStream<Ydb.Query.ExecuteQueryResponsePart> | undefined;
    let execStats: Ydb.TableStats.IQueryStats | undefined;


    let unsub: CtxUnsubcribe;
    if (this.ctx.onCancel) {
        unsub = this.ctx.onCancel((cause) => {
            cancel(cause);
        });
    }

    // One operation per session in a time. And it might be cancelled
    if (this[sessionCurrentOperationSymbol]) throw new Error('There\'s another active operation in the session');

    const cancel = (reason: any, onStreamError?: boolean) => {
        if (finished) return;
        finished = true;
        if (onStreamError !== true) responseStream!.cancel();
        if (unsub) unsub();
        if (resultReject) {
            resultReject(reason);
            resultResolve = resultReject = undefined;
        } else { // resultSet has already been returned to a client code
            resultSetIterator.error(reason);
            Object.values(resultSetByIndex).forEach(([iterator]) => {
                iterator.error(reason);
            });
        }
        if (finishedReject) finishedReject(reason);
        delete this[sessionCurrentOperationSymbol];
    }

    this[sessionCurrentOperationSymbol] = { cancel };

    // Operation
    responseStream = this[implSymbol].grpcServiceClient!.makeServerStreamRequest(
        '/Ydb.Query.V1.QueryService/ExecuteQuery',
        (v) => Ydb.Query.ExecuteQueryRequest.encode(v).finish() as Buffer,
        Ydb.Query.ExecuteQueryResponsePart.decode,
        Ydb.Query.ExecuteQueryRequest.create(executeQueryRequest),
        this[implSymbol].metadata);

    responseStream.on('data', (partialResp: Ydb.Query.ExecuteQueryResponsePart) => {
        this.logger.trace('execute(): data: %o', partialResp);

        try {
            ensureCallSucceeded(partialResp);
        } catch (ydbErr) {
            delete this[sessionTxIdSymbol]

            return cancel(ydbErr);
        }

        if (partialResp.txMeta?.id)
            this[sessionTxIdSymbol] = partialResp.txMeta!.id;

        if (partialResp.resultSet) {

            const _index = partialResp.resultSetIndex;
            const index = Long.isLong(_index) ? (_index as Long).toInt() : (resultSetByIndex as unknown as number);

            let iterator: IAsyncQueueIterator<{ [key: string]: any }>;
            let resultSet: ResultSet;

            let resultSetTuple = resultSetByIndex[index];
            if (!resultSetTuple) {
                iterator = buildAsyncQueueIterator<Ydb.IValue>();
                switch (args.rowMode) {
                    case RowType.Ydb:
                        resultSet = new ResultSet(index, partialResp.resultSet!.columns as IColumn[], args.rowMode ?? RowType.Native, iterator);
                        break;
                    default: // Native
                        const nativeColumnsNames = (partialResp.resultSet!.columns as IColumn[]).map(v => snakeToCamelCaseConversion.ydbToJs(v.name!));
                        resultSet = new ResultSet(index, nativeColumnsNames, args.rowMode ?? RowType.Native, iterator);
                        resultSet[resultsetYdbColumnsSymbol] = partialResp.resultSet!.columns as IColumn[];
                }
                resultSetIterator.push(resultSet);
                resultSetByIndex[index] = [iterator, resultSet];
                if (!concurrentResultSets) {
                    lastRowsIterator?.end();
                    lastRowsIterator = iterator;
                }
            } else {
                [iterator, resultSet] = resultSetTuple;
            }

            switch (args.rowMode) {
                case RowType.Ydb:
                    for (const row of partialResp.resultSet!.rows!) iterator.push(row);
                    break;
                default: // Native
                    for (const row of partialResp.resultSet!.rows!) {
                        // TODO: Rewrite to reduce
                        const nativeRow: { [key: string]: any } = {}; // reduced was not used due some strange typing behaviour
                        try {
                            row.items?.forEach((v, i) => {
                                const nativeColumnName = (resultSet.columns as string[])[i];
                                nativeRow[nativeColumnName] = convertYdbValueToNative(resultSet[resultsetYdbColumnsSymbol]![i].type!, v);
                            });
                        } catch (err) {
                            throw err;
                        }
                        iterator.push(nativeRow);
                    }
            }

            if (resultResolve) {
                resultResolve({
                    resultSets: resultSetIterator[Symbol.asyncIterator](), // a list with first block already in it
                    get execStats() {
                        return execStats
                    },
                    opFinished: new Promise<void>((resolve, reject) => {
                        finishedResolve = resolve;
                        finishedReject = reject;
                    })
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
        this.logger.trace('execute(): error: %o', err);
        if (err.code === 1) return; // skip "cancelled" error
        cancel(TransportError.convertToYdbError(err), true);
    });

    responseStream.on('metadata', (metadata) => {
        if (this[sessionTrailerCallbackSymbol]) {
            this[sessionTrailerCallbackSymbol](metadata);
        }

        // TODO: Process partial meta
        // TODO: Expect to see on graceful shutdown
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
                get execStats() {
                    return execStats
                },
                opFinished: Promise.resolve()
            });
            resultResolve = resultReject = undefined;
        }

        if (args.txControl?.commitTx) {
            delete this[sessionTxIdSymbol]
        }

        if (finishedResolve) finishedResolve();
        delete this[sessionCurrentOperationSymbol];
        if (unsub) unsub();
        finished = true;
    });

    return new Promise<IExecuteResult>((resolve, reject) => {
        resultResolve = resolve;
        resultReject = reject;
    });
}
