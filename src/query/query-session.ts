// import {promisify} from 'util'
import EventEmitter from 'events';
// import * as grpc from '@grpc/grpc-js';
import {Ydb} from 'ydb-sdk-proto';
import {Endpoint} from '../discovery';
import {Logger} from '../logging';
import {retryable} from '../retries';
import QueryService = Ydb.Query.V1.QueryService;
import ICreateSessionResponse = Ydb.Query.ICreateSessionResponse;
import ITransactionSettings = Ydb.Query.ITransactionSettings;
import {SessionEvent} from "../table";
import {ensureOperationSucceeded} from "./query-utils";
import {pessimizable} from "../utils";

// TODO: Add context to session
export class QuerySession extends EventEmitter implements ICreateSessionResponse {
    // TODO: Allocate common functionality with querySession to a sessionBase class. It's likely that commo sessionsPool code will work both Query and Query
    private beingDeleted = false;
    private free = true;
    private closing = false;
    private txId?: string;

    constructor(
        private api: QueryService,
        public endpoint: Endpoint,
        public sessionId: string,
        private logger: Logger,
        // private getResponseMetadata: (request: object) => grpc.Metadata | undefined
    ) {
        super();
    }

    async attach() {
        // TODO: Rewrite

       // promisify(this.api.attachSession)()
      // const state = new Promise<Ydb.Query.SessionState | undefined>((resolve, reject) => {
      //     this.api.attachSession({sessionId: this.sessionId}, (error, response) => {
      //         console.info(1000, 'sessionId', this.sessionId, error, response);
      //         if (error) reject(error);
      //         resolve(response);
      //     });
      // });
      // if (state) {
      //     console.info(1100, 'state', state);
      // }
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
        ensureOperationSucceeded(await this.api.deleteSession({sessionId: this.sessionId}));
    }

    @retryable()
    @pessimizable
    public async beginTransaction(
        txSettings: ITransactionSettings,
    )/*: Promise<ITransactionMeta>*/ {
        if (this.txId) throw new Error('There is already opened transaction');
        const request: Ydb.Query.IBeginTransactionRequest = {
            sessionId: this.sessionId,
            txSettings,
        };
        const response = ensureOperationSucceeded(await this.api.beginTransaction(request));
        const {txMeta} = response;
        if (!txMeta?.id) throw new Error('Could not begin new transaction, txMeta.id is empty!');
        this.txId = txMeta!.id!;
    }

    @retryable()
    @pessimizable
    public async commitTransaction(): Promise<void> {
        if (!this.txId) throw new Error('There is no an open transaction');
        const request: Ydb.Query.ICommitTransactionRequest = {
            sessionId: this.sessionId,
            txId: this.txId,
        };
        delete this.txId;
        ensureOperationSucceeded(await this.api.commitTransaction(request));
    }

    @retryable()
    @pessimizable
    public async rollbackTransaction(): Promise<void> {
        if (!this.txId) throw new Error('There is no an open transaction');
        const request: Ydb.Query.IRollbackTransactionRequest = {
            sessionId: this.sessionId,
            txId: this.txId,
        };
        delete this.txId;
        await this.api.rollbackTransaction(request);
    }
}
