import {
    TopicWriteStreamWithEvents,
    WriteStreamInitArgs,
    WriteStreamWriteArgs, WriteStreamWriteResult
} from "./internal/topic-write-stream-with-events";
import {Logger} from "../logger/simple-logger";
import {RetryLambdaResult, RetryStrategy} from "../retries/retryStrategy";
import {Context, CtxUnsubcribe, ensureContext} from "../context";
import Long from "long";
import {closeSymbol} from "./symbols";
import {Ydb} from "ydb-sdk-proto";
import DiscoveryService from "../discovery/discovery-service";

type SendMessagesResult =
    Omit<Ydb.Topic.StreamWriteMessage.IWriteResponse, 'acks'>
    & Ydb.Topic.StreamWriteMessage.WriteResponse.IWriteAck;

type messageQueueItem = {
    args: WriteStreamWriteArgs,
    resolve: (value: SendMessagesResult | PromiseLike<SendMessagesResult>) => void,
    reject: (reason?: any) => void
};

export class TopicWriter {
    private messageQueue: messageQueueItem[] = [];
    private closingReason?: Error;
    private firstInnerStreamInitResp? = true;
    private getLastSeqNo?: boolean; // true if client to proceed sequence based on last known seqNo
    private lastSeqNo?: Long.Long;
    private attemptPromise?: Promise<RetryLambdaResult<void>>;
    // @ts-ignore
    private attemptPromiseResolve?: (value: (PromiseLike<RetryLambdaResult<void>> | RetryLambdaResult<void>)) => void;
    // @ts-ignore
    private attemptPromiseReject?: (value: any) => void;
    private innerWriteStream?: TopicWriteStreamWithEvents;

    constructor(
        ctx: Context,
        private writeStreamArgs: WriteStreamInitArgs,
        private retrier: RetryStrategy,
        private discovery: DiscoveryService,
        private logger: Logger) {
        this.getLastSeqNo = !!writeStreamArgs.getLastSeqNo;
        logger.trace('%s: new TopicWriter: %o', ctx, writeStreamArgs);
        let onCancelUnsub: CtxUnsubcribe;
        if (ctx.onCancel) onCancelUnsub = ctx.onCancel((cause) => {
            if (this.closingReason) return;
            this.closingReason = cause;
            this.close(ctx, true)
        });
        // background process of sending and retrying
        this.retrier.retry<void>(ctx, async (ctx, logger, attemptsCount) => {
            logger.trace('%s: retry %d', ctx, attemptsCount);
            this.attemptPromise = new Promise<RetryLambdaResult<void>>((resolve, reject) => {
                this.attemptPromiseResolve = resolve;
                this.attemptPromiseReject = reject;
            });
            await this.initInnerStream(ctx);
            return this.attemptPromise
                .catch((err) => {
                    logger.trace('%s: error: %o', ctx, err);
                    if (this.messageQueue.length > 0) {
                        return {
                            err: err as Error,
                            idempotent: true
                        };
                    }
                    return this.closingReason && (this.closingReason as any).cause === closeSymbol
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
                this.closingReason = err;
                this.spreadError(ctx, err);
            })
            .finally(() => {
                onCancelUnsub();
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
        const stream = new TopicWriteStreamWithEvents(ctx, this.writeStreamArgs, await this.discovery.getTopicNodeClient(), this.logger);
        // TODO: Wrap callback
        stream.events.on('initResponse', (resp) => {
            this.logger.trace('%s: on initResponse: %o', ctx, resp);
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
            this.logger.trace('%s: on writeResponse: %o', ctx, resp);
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
            }
        });
        stream.events.on('error', (err) => {
            this.logger.trace('%s: TopicWriter.on "error": %o', ctx, err);
            try {
                this.closingReason = err;
                this.spreadError(ctx, err);
            } catch (err) {
                if (!this.attemptPromiseReject) throw err;
                this.attemptPromiseReject(err)
            }
        });
        stream.events.on('end', () => {
            this.logger.trace('%s: TopicWriter.on "end": %o', ctx);
            try {
                stream.close(ctx);
                delete this.innerWriteStream;
            } catch (err) {
                if (!this.attemptPromiseReject) throw err;
                this.attemptPromiseReject(err)
            }
        });
    }

    private closeInnerStream(ctx: Context) {
        this.logger.trace('%s: closeInnerStream()', ctx);
        this.innerWriteStream?.close(ctx);
        delete this.innerWriteStream;
    }

    // @ts-ignore
    public close(force?: boolean): void;
    public close(ctx: Context, force?: boolean): void;
    @ensureContext(true)
    public close(ctx: Context, force?: boolean) {
        this.logger.trace('%s: close(): %o', ctx, force);
        if (this.closingReason) return;
        this.closingReason = new Error('close invoked');
        (this.closingReason as any).cause = closeSymbol;
        if (force || this.messageQueue.length === 0) {
            this.innerWriteStream?.close(ctx);
            this.spreadError(ctx, this.closingReason);
            this.messageQueue.length = 0; // drop queue
        }
    }

    // @ts-ignore
    public sendMessages(sendMessagesArgs: WriteStreamWriteArgs): Promise<WriteStreamWriteResult>;
    public sendMessages(ctx: Context, sendMessagesArgs: WriteStreamWriteArgs): Promise<WriteStreamWriteResult>;
    @ensureContext(true)
    public sendMessages(ctx: Context, sendMessagesArgs: WriteStreamWriteArgs): Promise<WriteStreamWriteResult> {
        this.logger.trace('%s: sendMessages(): %o', ctx, sendMessagesArgs);
        if (this.closingReason) return Promise.reject(this.closingReason);
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
        return new Promise<WriteStreamWriteResult>((resolve, reject) => {
            this.messageQueue.push({args: sendMessagesArgs, resolve, reject})
            this.innerWriteStream?.writeRequest(ctx, sendMessagesArgs);
        });
    }

    /**
     * Notify all incomplete Promise that an error has occurred.
     */
    private spreadError(_ctx: Context, err: any) {
        this.messageQueue.forEach((item) => {
            item.reject(err);
        });
        this.messageQueue.length = 0;
    }
}
