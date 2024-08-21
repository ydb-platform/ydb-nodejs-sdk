"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = exports.CANNOT_MANAGE_TRASACTIONS_ERROR = void 0;
var ydb_sdk_proto_1 = require("ydb-sdk-proto");
var symbols_1 = require("./symbols");
var build_async_queue_iterator_1 = require("../utils/build-async-queue-iterator");
var ResultSet_1 = require("./ResultSet");
var process_ydb_operation_result_1 = require("../utils/process-ydb-operation-result");
var long_1 = require("long");
var errors_1 = require("../errors");
var query_session_1 = require("./query-session");
var types_1 = require("../types");
exports.CANNOT_MANAGE_TRASACTIONS_ERROR = 'Cannot manage transactions at the session level if do() has the txSettings parameter or doTx() is used';
/**
 * Finishes when the first data block is received or when the end of the stream is received. So if you are sure
 * that the operation does not return any data, you may not process resultSets.
 */
function execute(opts) {
    var _this = this;
    var _a, _b, _c, _d, _e, _f, _g;
    // Validate opts
    if (!opts.text.trim())
        throw new Error('"text" parameter is empty');
    if (opts.parameters)
        Object.keys(opts.parameters).forEach(function (n) {
            if (!n.startsWith('$'))
                throw new Error("Parameter name must start with \"$\": ".concat(n));
        });
    if (opts.txControl && this[symbols_1.sessionTxSettingsSymbol])
        throw new Error(exports.CANNOT_MANAGE_TRASACTIONS_ERROR);
    if ((_a = opts.txControl) === null || _a === void 0 ? void 0 : _a.txId)
        throw new Error('Cannot contain txControl.txId because the current session transaction is used (see session.txId)');
    if (this[symbols_1.sessionTxIdSymbol]) {
        if ((_b = opts.txControl) === null || _b === void 0 ? void 0 : _b.beginTx)
            throw new Error('txControl.beginTx when there\'s already an open transaction');
    }
    else {
        if (((_c = opts.txControl) === null || _c === void 0 ? void 0 : _c.commitTx) && !((_d = opts.txControl) === null || _d === void 0 ? void 0 : _d.beginTx))
            throw new Error('txControl.commitTx === true when no open transaction and there\'s no txControl.beginTx');
    }
    // Build params
    var executeQueryRequest = {
        sessionId: this.sessionId,
        queryContent: {
            text: opts.text,
            syntax: (_e = opts.syntax) !== null && _e !== void 0 ? _e : ydb_sdk_proto_1.Ydb.Query.Syntax.SYNTAX_YQL_V1,
        },
        execMode: (_f = opts.execMode) !== null && _f !== void 0 ? _f : ydb_sdk_proto_1.Ydb.Query.ExecMode.EXEC_MODE_EXECUTE,
    };
    if (opts.statsMode)
        executeQueryRequest.statsMode = opts.statsMode;
    if (opts.parameters)
        executeQueryRequest.parameters = opts.parameters;
    if (this[symbols_1.sessionTxSettingsSymbol] && !this[symbols_1.sessionTxIdSymbol])
        executeQueryRequest.txControl = { beginTx: this[symbols_1.sessionTxSettingsSymbol], commitTx: false };
    else if (opts.txControl)
        executeQueryRequest.txControl = opts.txControl;
    if (this[symbols_1.sessionTxIdSymbol])
        (executeQueryRequest.txControl || (executeQueryRequest.txControl = {})).txId = this[symbols_1.sessionTxIdSymbol];
    executeQueryRequest.concurrentResultSets = (_g = opts.concurrentResultSets) !== null && _g !== void 0 ? _g : false;
    if (opts.hasOwnProperty('idempotent')) {
        if (this[symbols_1.isIdempotentDoLevelSymbol])
            throw new Error('The attribute of idempotency is already set at the level of do()');
        if (opts.idempotent)
            this[symbols_1.isIdempotentSymbol] = true;
    }
    // Run the operation
    var finished = false;
    var resultSetByIndex = [];
    var resultSetIterator = (0, build_async_queue_iterator_1.buildAsyncQueueIterator)();
    var concurrentResultSets = executeQueryRequest.concurrentResultSets;
    var lastRowsIterator;
    var resultResolve;
    var resultReject;
    var finishedResolve;
    var finishedReject;
    var responseStream;
    var execStats;
    var unsub;
    if (this.ctx.onCancel) {
        unsub = this.ctx.onCancel(function (cause) {
            cancel(cause);
        });
    }
    // One operation per session in a time. And it might be cancelled
    if (this[symbols_1.sessionCurrentOperationSymbol])
        throw new Error('There\'s another active operation in the session');
    var cancel = function (reason, onStreamError) {
        if (finished)
            return;
        finished = true;
        if (onStreamError !== true)
            responseStream.cancel();
        if (unsub)
            unsub();
        if (resultReject) {
            resultReject(reason);
            resultResolve = resultReject = undefined;
        }
        else { // resultSet has already been returned to a client code
            resultSetIterator.error(reason);
            Object.values(resultSetByIndex).forEach(function (_a) {
                var iterator = _a[0];
                iterator.error(reason);
            });
        }
        if (finishedReject)
            finishedReject(reason);
        delete _this[symbols_1.sessionCurrentOperationSymbol];
    };
    this[symbols_1.sessionCurrentOperationSymbol] = { cancel: cancel };
    // Operation
    responseStream = this[query_session_1.implSymbol].grpcClient.makeServerStreamRequest("/Ydb.Query.V1.QueryService/ExecuteQuery" /* Query_V1.ExecuteQuery */, function (v) { return ydb_sdk_proto_1.Ydb.Query.ExecuteQueryRequest.encode(v).finish(); }, ydb_sdk_proto_1.Ydb.Query.ExecuteQueryResponsePart.decode, ydb_sdk_proto_1.Ydb.Query.ExecuteQueryRequest.create(executeQueryRequest), this[query_session_1.implSymbol].metadata);
    responseStream.on('data', function (partialResp) {
        var _a, _b, _c, _d;
        _this.logger.trace('execute(): data: %o', partialResp);
        try {
            (0, process_ydb_operation_result_1.ensureCallSucceeded)(partialResp);
        }
        catch (ydbErr) {
            return cancel(ydbErr);
        }
        if ((_a = partialResp.txMeta) === null || _a === void 0 ? void 0 : _a.id)
            _this[symbols_1.sessionTxIdSymbol] = partialResp.txMeta.id;
        else
            delete _this[symbols_1.sessionTxIdSymbol];
        if (partialResp.resultSet) {
            var _index = partialResp.resultSetIndex;
            var index = long_1.default.isLong(_index) ? _index.toInt() : resultSetByIndex;
            var iterator = void 0;
            var resultSet_1;
            var resultSetTuple = resultSetByIndex[index];
            if (!resultSetTuple) {
                iterator = (0, build_async_queue_iterator_1.buildAsyncQueueIterator)();
                switch (opts.rowMode) {
                    case 1 /* RowType.Ydb */:
                        resultSet_1 = new ResultSet_1.ResultSet(index, partialResp.resultSet.columns, (_b = opts.rowMode) !== null && _b !== void 0 ? _b : 0 /* RowType.Native */, iterator);
                        break;
                    default: // Native
                        var nativeColumnsNames = partialResp.resultSet.columns.map(function (v) { return types_1.snakeToCamelCaseConversion.ydbToJs(v.name); });
                        resultSet_1 = new ResultSet_1.ResultSet(index, nativeColumnsNames, (_c = opts.rowMode) !== null && _c !== void 0 ? _c : 0 /* RowType.Native */, iterator);
                        resultSet_1[symbols_1.resultsetYdbColumnsSymbol] = partialResp.resultSet.columns;
                }
                resultSetIterator.push(resultSet_1);
                resultSetByIndex[index] = [iterator, resultSet_1];
                if (!concurrentResultSets) {
                    lastRowsIterator === null || lastRowsIterator === void 0 ? void 0 : lastRowsIterator.end();
                    lastRowsIterator = iterator;
                }
            }
            else {
                iterator = resultSetTuple[0], resultSet_1 = resultSetTuple[1];
            }
            switch (opts.rowMode) {
                case 1 /* RowType.Ydb */:
                    for (var _i = 0, _e = partialResp.resultSet.rows; _i < _e.length; _i++) {
                        var row = _e[_i];
                        iterator.push(row);
                    }
                    break;
                default: // Native
                    var _loop_1 = function (row) {
                        // TODO: Rewrite to reduce
                        var nativeRow = {}; // reduced was not used due some strange typing behaviour
                        try {
                            (_d = row.items) === null || _d === void 0 ? void 0 : _d.forEach(function (v, i) {
                                var nativeColumnName = resultSet_1.columns[i];
                                nativeRow[nativeColumnName] = (0, types_1.convertYdbValueToNative)(resultSet_1[symbols_1.resultsetYdbColumnsSymbol][i].type, v);
                            });
                        }
                        catch (err) {
                            throw err;
                        }
                        iterator.push(nativeRow);
                    };
                    for (var _f = 0, _g = partialResp.resultSet.rows; _f < _g.length; _f++) {
                        var row = _g[_f];
                        _loop_1(row);
                    }
            }
            if (resultResolve) {
                resultResolve({
                    resultSets: resultSetIterator[Symbol.asyncIterator](), // a list with first block already in it
                    get execStats() {
                        return execStats;
                    },
                    opFinished: new Promise(function (resolve, reject) {
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
        partialResp.txMeta;
    });
    responseStream.on('error', function (err) {
        _this.logger.trace('execute(): error: %o', err);
        if (err.code === 1)
            return; // skip "cancelled" error
        cancel(errors_1.TransportError.convertToYdbError(err), true);
    });
    responseStream.on('metadata', function (_metadata) {
        // TODO: Process partial meta
        // TODO: Expect to see on graceful shutdown
    });
    responseStream.on('end', function () {
        if (finished)
            return; // finished by cancel() - error or timeout. note: got to be before any logging, so Jest would not complain on logging after test end
        _this.logger.trace('execute(): end');
        resultSetIterator.end();
        if (concurrentResultSets) {
            Object.values(resultSetByIndex).forEach(function (_a) {
                var iterator = _a[0];
                iterator.end();
            });
        }
        else {
            lastRowsIterator === null || lastRowsIterator === void 0 ? void 0 : lastRowsIterator.end();
        }
        if (resultResolve) {
            resultResolve({
                resultSets: resultSetIterator[Symbol.asyncIterator](), // an empty list
                get execStats() {
                    return execStats;
                },
                opFinished: Promise.resolve()
            });
            resultResolve = resultReject = undefined;
        }
        if (finishedResolve)
            finishedResolve();
        delete _this[symbols_1.sessionCurrentOperationSymbol];
        if (unsub)
            unsub();
        finished = true;
    });
    return new Promise(function (resolve, reject) {
        resultResolve = resolve;
        resultReject = reject;
    });
}
exports.execute = execute;
