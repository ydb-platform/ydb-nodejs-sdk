import EventEmitter from "events";
import {QueryService, SessionBuilder, SessionEvent} from "./query-session-pool";
import {Endpoint} from "../discovery";
import {Logger} from "../logging";
import {retryable} from "../retries";
import {pessimizable} from "../utils";
import {ensureCallSucceeded} from "../utils/process-ydb-operation-result";
import {Ydb} from "ydb-sdk-proto";
import {TransportError} from "../errors";
import {buildAsyncQueueIterator} from "../utils/build-async-queue-iterator";
import ICreateSessionResult = Ydb.Table.ICreateSessionResult;
import IQueryContent = Ydb.Query.IQueryContent;
import ExecMode = Ydb.Query.ExecMode;
import IExecuteQueryRequest = Ydb.Query.IExecuteQueryRequest;

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

    public exec(opts: {
        queryContent: IQueryContent,
        execMode?: Ydb.Query.ExecMode,
        txControl?: Ydb.Query.ITransactionControl,
        parameters?: { [k: string]: Ydb.ITypedValue },
        statsMode?: Ydb.Query.StatsMode,
        concurrentResultSets?: boolean,
    }) {
        const params: IExecuteQueryRequest = {
            sessionId: this.sessionId,
            queryContent: opts.queryContent,
            execMode: opts.execMode ?? ExecMode.EXEC_MODE_EXECUTE,
        };
        if (opts.txControl) params.txControl = opts.txControl;
        if (opts.parameters) params.parameters = opts.parameters;
        if (opts.statsMode) params.statsMode = opts.statsMode;
        // if (opts.concurrentResultSets) params.execMode = opts.concurrentResultSets; // TODO: Implement both mode

        const res = buildAsyncQueueIterator<string>();

        const responseStream = this.impl.grpcClient!.makeServerStreamRequest(
            Query_V1.ExecuteQuery,
            (v) => Ydb.Query.ExecuteQueryRequest.encode(v).finish() as Buffer,
            Ydb.Query.ExecuteQueryResponsePart.decode,
            Ydb.Query.ExecuteQueryRequest.create(params),
            this.impl.metadata);

        responseStream.on('data', (partialResp: Ydb.Query.ExecuteQueryResponsePart) => {
            this.logger.debug('exec(): data: %o', partialResp);
        });

        responseStream.on('metadata', (metadata) => {
            // TODO: Expec to see on graceful shutdown
            this.logger.debug('exec(): metadata: %o', metadata);

        });

        responseStream.on('end', () => {
            this.logger.debug('exec(): end');
        });

        responseStream.on('error', (err) => {
            // TODO: Should wrap transport error?
            this.logger.debug('exec(): error: %o', err);

        });

        return res;
        // {
        // TODO: result sets enum
        // TODO: result set class
        // TODO: another return for concurrentResultSets
        // }
    }
}
