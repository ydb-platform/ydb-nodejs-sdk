import EventEmitter from "events";
import {QueryService, SessionBuilder, SessionEvent} from "./query-session-pool";
import {Endpoint} from "../discovery";
import {Logger} from "../logging";
import {retryable} from "../retries";
import {pessimizable} from "../utils";
import {ensureCallSucceeded} from "../utils/process-ydb-operation-result";
import {Ydb} from "ydb-sdk-proto";
import {ClientReadableStream} from "@grpc/grpc-js";
import * as symbols from './symbols';
import ICreateSessionResult = Ydb.Table.ICreateSessionResult;

import {attach as attachImpl} from './query-session-attach';
import {CANNOT_MANAGE_TRASACTIONS_ERROR, execute as executeImpl} from './query-session-execute';
import {
    beginTransaction,
    beginTransaction as beginTransactionImpl, commitTransaction,
    commitTransaction as commitTransactionImpl,
    rollbackTransaction as rollbackTransactionImpl
} from './query-session-transaction';

/**
 * Service methods, as they name in GRPC.
 */
export const enum Query_V1 {
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

export const api = Symbol('api');
export const impl = Symbol('impl');
export const attachStream = Symbol('attachStream');

export class QuerySession extends EventEmitter implements ICreateSessionResult {
    [symbols.sessionCurrentOperation]?: QuerySessionOperation;
    [symbols.sessionId]: string;
    [symbols.sessionTxId]?: string;
    [symbols.sessionTxSettings]?: Ydb.Query.ITransactionSettings;

    // TODO: Add doTx transaction settings

    // private fields, available in the methods placed in separated files
    [impl]: SessionBuilder;
    [attachStream]?: ClientReadableStream<Ydb.Query.SessionState>;
    [api]: QueryService;

    // TODO: Move those fields to SessionBase
    private beingDeleted = false;
    private free = true;
    private closing = false;

    public get sessionId() {
        return this[symbols.sessionId];
    }

    public get txId() {
        return this[symbols.sessionTxId];
    }

    private constructor( // TODO: Change to named parameters for consistency
        _api: QueryService,
        _impl: SessionBuilder,
        public endpoint: Endpoint,
        sessionId: string,
        public readonly logger: Logger,
        // TODO: Add timeout
    ) {
        super();
        this[api] = _api;
        this[impl] = _impl;
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
        await this[attachStream]?.cancel();
        delete this[attachStream]; // only one stream cancel even when multi ple retries
        ensureCallSucceeded(await this[api].deleteSession({sessionId: this.sessionId}));
    }

    // TODO: Uncomment after switch to TS 5.3
    // [Symbol.asyncDispose]() {
    //     return this.delete();
    // }

    [symbols.sessionAttach] = attachImpl;

    public async beginTransaction(txSettings: Ydb.Query.ITransactionSettings | null = null) {
        if (this[symbols.sessionTxSettings]) throw new Error(CANNOT_MANAGE_TRASACTIONS_ERROR);
        return beginTransaction.call(this, txSettings);
    }

    public async commitTransaction() {
        if (this[symbols.sessionTxSettings]) throw new Error(CANNOT_MANAGE_TRASACTIONS_ERROR);
        return commitTransaction.call(this);
    }

    public async rollbackTransaction() {
        if (this[symbols.sessionTxSettings]) throw new Error(CANNOT_MANAGE_TRASACTIONS_ERROR);
        return rollbackTransactionImpl.call(this);
    }

    public [symbols.sessionBeginTransaction] = beginTransactionImpl;
    public [symbols.sessionCommitTransaction] = commitTransactionImpl;
    public [symbols.sessionRollbackTransaction] = rollbackTransactionImpl;

    public execute = executeImpl;
}
