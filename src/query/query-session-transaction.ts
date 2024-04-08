import {Ydb} from "ydb-sdk-proto";
import * as symbols from "./symbols";
import {ensureCallSucceeded} from "../utils/process-ydb-operation-result";
import {apiSymbol, QuerySession} from "./query-session";

export async function beginTransaction(this: QuerySession, txSettings: Ydb.Query.ITransactionSettings | null = null) {
    if (this[symbols.sessionTxIdSymbol]) throw new Error('There is already opened transaction');
    const {txMeta} = ensureCallSucceeded(await this[apiSymbol].beginTransaction({
        sessionId: this.sessionId,
        txSettings,
    }));
    if (this[symbols.sessionTxIdSymbol]) throw new Error('Simultaneous beginTransaction() occurred');
    if (txMeta!.id) this[symbols.sessionTxIdSymbol] = txMeta!.id;
}

export async function commitTransaction(this: QuerySession) {
    if (!this[symbols.sessionTxIdSymbol]) throw new Error('There is no an open transaction');
    try {
        return ensureCallSucceeded(await this[apiSymbol].commitTransaction({
            sessionId: this.sessionId,
            txId: this[symbols.sessionTxIdSymbol],
        }));
    } finally {
        delete this[symbols.sessionTxIdSymbol];
    }
}

export async function rollbackTransaction(this: QuerySession) {
    if (!this[symbols.sessionTxIdSymbol]) throw new Error('There is no an open transaction');
    try {
        return ensureCallSucceeded(await this[apiSymbol].rollbackTransaction({
            sessionId: this.sessionId,
            txId: this[symbols.sessionTxIdSymbol],
        }));
    } finally {
        delete this[symbols.sessionTxIdSymbol];
    }
}

