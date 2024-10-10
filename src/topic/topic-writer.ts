import {
    InternalTopicWriteStream,
    InternalWriteStreamInitArgs,
} from "./internal/internal-topic-write-stream";
import {Logger} from "../logger/simple-logger";
import {RetryLambdaResult, RetryStrategy} from "../retries/retryStrategy";
import {Context, CtxUnsubcribe, ensureContext} from "../context";
import Long from "long";
import {closeSymbol} from "./symbols";
import {google, Ydb} from "ydb-sdk-proto";
import DiscoveryService from "../discovery/discovery-service";

export type ISendArgs = {
    messages: ({
        data: Uint8Array;
        seqNo?: (number|Long|null);
        createdAt?: (google.protobuf.ITimestamp|null);
        uncompressedSize?: (number|Long|null);
        messageGroupId?: (string|null);
        partitionId?: (number|Long|null);
        metadataItems?: (Ydb.Topic.IMetadataItem[]|null);
    }[]|null);
    codec?: (number|null);
    tx?: (Ydb.Topic.ITransactionIdentity|null);
}

export type ISendResult = {
}

type IMessageQueueItem = {
    args: ISendArgs,
    resolve: (value: ISendResult | PromiseLike<ISendResult>) => void,
    reject: (reason?: any) => void
};

export class TopicWriter {
    private messageQueue: IMessageQueueItem[] = [];
    private reasonForClose?: Error;
    private closeResolve?: () => void;
    private firstInnerStreamInitResp? = true;
    private getLastSeqNo?: boolean; // true if client to proceed sequence based on last known seqNo
    private lastSeqNo?: Long.Long;
    private attemptPromiseReject?: (value: any) => void;
    private innerWriteStream?: InternalTopicWriteStream;

    constructor(
        ctx: Context,
        private writeStreamArgs: InternalWriteStreamInitArgs,
        private retrier: RetryStrategy,
        private discovery: DiscoveryService,
        private logger: Logger) {
        this.getLastSeqNo = !!writeStreamArgs.getLastSeqNo;
        logger.trace('%s: new TopicWriter', ctx);
        let onCancelUnsub: CtxUnsubcribe;
        if (ctx.onCancel) onCancelUnsub = ctx.onCancel((cause) => {
            if (this.reasonForClose) return;
            this.reasonForClose = cause;
            this.close(ctx, true)
        });
        // background process of sending and retrying
        this.retrier.retry<void>(ctx, async (ctx, logger, attemptsCount) => {
            logger.trace('%s: retry %d', ctx, attemptsCount);
            const attemptPromise = new Promise<RetryLambdaResult<void>>((_, reject) => {
                this.attemptPromiseReject = reject;
            });
            await this.initInnerStream(ctx);
            return attemptPromise
                .catch((err) => {
                    logger.trace('%s: retrier error: %o', ctx, err);
                    if (this.messageQueue.length > 0) {
                        return {
                            err: err as Error,
                            idempotent: true
                        };
                    }
                    return this.reasonForClose && (this.reasonForClose as any).cause === closeSymbol
                        ? {} // stream is correctly closed
                        : {
                            err: err as Error,
                            idempotent: true
                        };
                })
                .finally(() => {
                    this.closeInnerStream(ctx);
                });
        })
            .then(() => {
                logger.debug('%s: closed successfully', ctx);
            })
            .catch((err) => {
                logger.debug('%s: failed: %o', ctx, err);
                this.reasonForClose = err;
                this.spreadError(ctx, err);
                this.close();
            })
            .finally(() => {
                if (onCancelUnsub) onCancelUnsub();
            });

    }

    private async initInnerStream(ctx: Context) {
        this.logger.trace('%s: initInnerStream()', ctx);
        // fill lastSeqNo only when the first internal stream is opened
        if (!this.firstInnerStreamInitResp && this.writeStreamArgs.getLastSeqNo) {
            this.writeStreamArgs = Object.assign(this.writeStreamArgs);
            delete this.writeStreamArgs.getLastSeqNo;
        }
        delete this.firstInnerStreamInitResp;
        const stream = new InternalTopicWriteStream(ctx, this.writeStreamArgs, await this.discovery.getTopicNodeClient(), this.logger);
        stream.events.on('initResponse', (resp) => {
            this.logger.trace('%s: TopicWriter.on "initResponse"', ctx);
            try {
                // if received lastSeqNo in mode this.getLastSeqNo === true
                if (resp.lastSeqNo || resp.lastSeqNo === 0) {
                    this.lastSeqNo = Long.fromValue(resp.lastSeqNo);
                    // if there are messages that were queued before lastSeqNo was received
                    this.messageQueue.forEach((queueItem) => {
                        queueItem.args.messages!.forEach((message) => {
                            message.seqNo = this.lastSeqNo = this.lastSeqNo!.add(1);
                        });
                    });
                }
                // TODO: Send messages as one batch.  Add new messages to the batch if there are some
                this.messageQueue.forEach((queueItem) => {
                    stream.writeRequest(ctx, queueItem.args);
                });
                // this.innerWriteStream variable is defined only after the stream is initialized
                this.innerWriteStream = stream;
            } catch (err) {
                if (!this.attemptPromiseReject) throw err;
                this.attemptPromiseReject(err)
            }
        });
        stream.events.on('writeResponse', (resp) => {
            this.logger.trace('%s: TopicWriter.on "writeResponse"', ctx);
            try {
                const {acks, ...shortResp} = resp;
                resp.acks!.forEach((ack) => {
                    const queueItem = this.messageQueue.shift();
                    // TODO: Check seqNo is expected and queueItem is not an undefined
                    queueItem?.resolve({
                        ...shortResp,
                        ...ack,
                    });
                });
            } catch (err) {
                if (!this.attemptPromiseReject) throw err;
                this.attemptPromiseReject(err)
            } finally {
                if (this.closeResolve) this.closeResolve();
            }
        });
        stream.events.on('error', (err) => {
            this.logger.trace('%s: TopicWriter.on "error": %o', ctx, err);
            this.reasonForClose = err;
            this.spreadError(ctx, err);
            try {
                delete this.innerWriteStream;
                if (this.closeResolve) this.closeResolve();
            } catch (err) {
                if (!this.attemptPromiseReject) throw err;
                this.attemptPromiseReject(err)
            }
        });
        stream.events.on('end', (cause: Error) => {
            this.logger.trace('%s: TopicWriter.on "end": %o', ctx, cause);
            try {
                delete this.innerWriteStream;
                if (this.closeResolve) this.closeResolve();
            } catch (err) {
                if (!this.attemptPromiseReject) throw err;
                this.attemptPromiseReject(err)
            }
        });
    }

    private closeInnerStream(ctx: Context) {
        this.logger.trace('%s: TopicWriter.closeInnerStream()', ctx);
        this.innerWriteStream?.close(ctx);
        delete this.innerWriteStream;
    }

    // @ts-ignore
    public close(force?: boolean): void;
    public close(ctx: Context, force?: boolean): void;
    @ensureContext(true)
    public async close(ctx: Context, force?: boolean) {
        this.logger.trace('%s: TopicWriter.close(force: %o)', ctx, !!force);
        if (this.reasonForClose) return;
        this.reasonForClose = new Error('close invoked');
        (this.reasonForClose as any).cause = closeSymbol;
        if (force || this.messageQueue.length === 0) {
            this.innerWriteStream?.close(ctx);
            this.spreadError(ctx, this.reasonForClose);
            this.messageQueue.length = 0; // drop queue
            return;
        } else {
            return new Promise<void>((resolve) => {
                this.closeResolve = resolve;
            });
        }
    }

    // @ts-ignore
    public send(sendMessagesArgs: ISendArgs): Promise<ISendResult>;
    public send(ctx: Context, sendMessagesArgs: ISendArgs): Promise<ISendResult>;
    @ensureContext(true)
    public send(ctx: Context, sendMessagesArgs: ISendArgs): Promise<ISendResult> {
        this.logger.trace('%s: TopicWriter.sendMessages()', ctx);
        if (this.reasonForClose) return Promise.reject(this.reasonForClose);
        sendMessagesArgs.messages?.forEach((msg) => {
            if (this.getLastSeqNo) {
                if (!(msg.seqNo === undefined || msg.seqNo === null)) throw new Error('Writer was created with getLastSeqNo = true, explicit seqNo not supported');
                if (this.lastSeqNo) { // else wait till initResponse will be received
                    msg.seqNo = this.lastSeqNo = this.lastSeqNo.add(1);
                }
            } else {
                if (msg.seqNo === undefined || msg.seqNo === null) throw new Error('Writer was created without getLastSeqNo = true, explicit seqNo must be provided');
            }
        });
        return new Promise<ISendResult>((resolve, reject) => {
            this.messageQueue.push({args: sendMessagesArgs, resolve, reject})
            this.innerWriteStream?.writeRequest(ctx, sendMessagesArgs);
        });
    }

    /**
     * Notify all incomplete Promise that an error has occurred.
     */
    private spreadError(ctx: Context, err: any) {
        this.logger.trace('%s: TopicWriter.spreadError()', ctx);
        this.messageQueue.forEach((item) => {
            item.reject(err);
        });
        this.messageQueue.length = 0;
    }
}
