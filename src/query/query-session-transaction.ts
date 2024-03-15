import {Ydb} from "ydb-sdk-proto";
import * as symbols from "./symbols";
import {ensureCallSucceeded} from "../utils/process-ydb-operation-result";
import {api, QuerySession} from "./query-session";

export async function beginTransaction(this: QuerySession, txSettings: Ydb.Query.ITransactionSettings | null = null) {
    if (this[symbols.sessionTxId]) throw new Error('There is already opened transaction');
    const {txMeta} = ensureCallSucceeded(await this[api].beginTransaction({
        sessionId: this.sessionId,
        txSettings,
    }));
    if (this[symbols.sessionTxId]) throw new Error('Simultaneous beginTransaction() occurred');
    if (txMeta!.id) this[symbols.sessionTxId] = txMeta!.id;
}

export async function commitTransaction(this: QuerySession) {
    if (!this[symbols.sessionTxId]) throw new Error('There is no an open transaction');
    try {
        return ensureCallSucceeded(await this[api].commitTransaction({
            sessionId: this.sessionId,
            txId: this[symbols.sessionTxId],
        }));
    } finally {
        delete this[symbols.sessionTxId];
    }
}

export async function rollbackTransaction(this: QuerySession) {
    if (!this[symbols.sessionTxId]) throw new Error('There is no an open transaction');
    try {
        return ensureCallSucceeded(await this[api].rollbackTransaction({
            sessionId: this.sessionId,
            txId: this[symbols.sessionTxId],
        }));
    } finally {
        delete this[symbols.sessionTxId];
    }
}

