import {TopicNodeClient} from "./internal/topic-node-client";
import {
    TopicWriteStreamWithEvents,
    WriteStreamInitArgs,
    WriteStreamWriteArgs, WriteStreamWriteResult
} from "./internal/topic-write-stream-with-events";
import {Logger} from "../logger/simple-logger";
import {RetryLambdaResult, RetryStrategy} from "../retries/retryStrategy";
import {Context, ensureContext} from "../context";
import Long from "long";
import {closeSymbol} from "./symbols";

type messageQueueItem = {
    args: WriteStreamWriteArgs,
    resolve: (value: WriteStreamWriteResult | PromiseLike<WriteStreamWriteResult>) => void,
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
        private topicService: TopicNodeClient,
        private logger: Logger) {
        this.getLastSeqNo = !!writeStreamArgs.getLastSeqNo;
        logger.debug('%s: new TopicWriter: %o', ctx, writeStreamArgs);
        // background process of sending and retrying
        this.retrier.retry<void>(ctx, async (ctx, logger, attemptsCount) => {
            logger.debug('%s: retry %d', ctx, attemptsCount);
            this.attemptPromise = new Promise<RetryLambdaResult<void>>((resolve, reject) => {
                this.attemptPromiseResolve = resolve;
                this.attemptPromiseReject = reject;
            });
            await this.initInnerStream(ctx);
            this.attemptPromise
                .catch((err) => {
                    logger.debug('%s: error: %o', ctx, err);
                    return this.closingReason && this.messageQueue.length === 0
                        ? {} // stream is correctly closed. err
                        : {
                            err: err as Error,
                            idempotent: true
                        }
                })
                .finally(() => {
                    this.closeInnerStream(ctx);
                });
            return this.attemptPromise; // wait till stream will be 'closed' or an error, possibly retryable
        }).then(() => {
            logger.debug('%s: closed successfully', ctx);
        }).catch((err) => {
            logger.debug('%s: failed: %o', ctx, err);
            this.closingReason = err;
            this.spreadError(ctx, err);
        });
    }

    private initInnerStream(ctx: Context) {
        this.logger.debug('%s: closeInnerStream()', ctx);
        // fill lastSeqNo only when the first internal stream is opened
        if (!this.firstInnerStreamInitResp && this.writeStreamArgs.getLastSeqNo) {
            this.writeStreamArgs = Object.assign(this.writeStreamArgs);
            delete this.writeStreamArgs.getLastSeqNo;
        }
        delete this.firstInnerStreamInitResp;
        const stream = new TopicWriteStreamWithEvents(ctx, this.writeStreamArgs, this.topicService, this.logger);
        stream.events.on('initResponse', (resp) => {
            this.logger.debug('%s: on initResponse: %o', ctx, resp);
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
                stream.writeRequest(queueItem.args);
            });
            // this.innerWriteStream variable is defined only after the stream is initialized
            this.innerWriteStream = stream;
        });
    }

    private closeInnerStream(ctx: Context) {
        this.logger.debug('%s: closeInnerStream()', ctx);
        this.innerWriteStream?.close();
        delete this.innerWriteStream;
    }

    // @ts-ignore
    public close(force?: boolean);
    @ensureContext(true)
    public close(ctx: Context, force?: boolean) {
        this.logger.debug('%s: close(): %o', ctx, force);
        if (this.closingReason) return;
        this.closingReason = new Error('close invoked');
        (this.closingReason as any).cause = closeSymbol;
        if (force || this.messageQueue.length === 0) {
            this.spreadError(ctx, this.closingReason);
            this.messageQueue.length = 0; // drop queue
        }
    }

    // @ts-ignore
    public sendMessages(sendMessagesArgs: WriteStreamWriteArgs);
    @ensureContext(true)
    public sendMessages(ctx: Context, sendMessagesArgs: WriteStreamWriteArgs) {
        this.logger.debug('%s: sendMessages(): %o', ctx, sendMessagesArgs);
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
            this.innerWriteStream?.writeRequest(sendMessagesArgs);
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
