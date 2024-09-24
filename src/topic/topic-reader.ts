import {
    ReadStreamInitArgs, ReadStreamReadResult,
    TopicReadStreamWithEvents
} from "./internal/topic-read-stream-with-events";
import DiscoveryService from "../discovery/discovery-service";
import {RetryLambdaResult, RetryStrategy} from "../retries/retryStrategy";
import {Context, CtxUnsubcribe, ensureContext} from "../context";
import {Logger} from "../logger/simple-logger";
import {closeSymbol} from "./symbols";

export class TopicReader {
    private attemptPromise?: Promise<RetryLambdaResult<void>>;
    private closingReason?: Error;
    private attemptPromiseResolve?: (value: (PromiseLike<RetryLambdaResult<void>> | RetryLambdaResult<void>)) => void;
    private attemptPromiseReject?: (value: any) => void;
    private queue: ReadStreamReadResult[] = [];
    private waitNextResolve?: (value: unknown) => void;
    private innerReadStream?: TopicReadStreamWithEvents;

    private _messages?: { [Symbol.asyncIterator]: () => AsyncGenerator<ReadStreamReadResult, void> };

    public get messages() {
        if (this._messages) {
            const self = this;
            this._messages = {
                async* [Symbol.asyncIterator]() {
                    while (true) {
                        while (self.queue.length > 0) {
                            yield self.queue.shift() as ReadStreamReadResult; // TODO: Add commit method by prototype
                        }
                        if (self.closingReason) {
                            if ((self.closingReason as any).cause !== closeSymbol) throw self.closingReason;
                            return;
                        }
                        await new Promise((resolve) => {
                            self.waitNextResolve = resolve;
                        });
                        delete self.waitNextResolve;
                    }
                }
            }
        }
        return this._messages!;
    }

    constructor(ctx: Context, private readStreamArgs: ReadStreamInitArgs, private retrier: RetryStrategy, private discovery: DiscoveryService, private logger: Logger) {
        logger.trace('%s: new TopicReader: %o', ctx, readStreamArgs);
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
                    if (this.waitNextResolve) this.waitNextResolve(undefined);
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
                if (this.waitNextResolve) this.waitNextResolve(undefined);
            })
            .finally(() => {
                onCancelUnsub();
            });
    }

    private async initInnerStream(ctx: Context) {
        if (this.innerReadStream) throw new Error('Thetream was not deleted by "end" event')

        this.innerReadStream = new TopicReadStreamWithEvents(ctx, this.readStreamArgs, await this.discovery.getTopicNodeClient(), this.logger);

        // this.innerReadStream.events.on('initResponse', async (resp) => {
        //     try {
        //         // TODO: seqNo only first time
        //     } catch (err) {
        //         if (this.attemptPromiseReject) this.attemptPromiseReject(err);
        //         else throw err;
        //     }
        // });

        this.innerReadStream.events.on('readResponse', async (resp) => {
            this.logger.trace('%s: on "readResponse"', ctx);
            try {
                this.queue.push(resp);
                if (this.waitNextResolve) this.waitNextResolve(undefined);
            } catch (err) {
                if (this.attemptPromiseReject) this.attemptPromiseReject(err);
                else throw err;
            }
        });

        // TODO:
        // this.innerReadStream.events.on('commitOffsetResponse', async (req) => {
        //     this.logger.trace('%s: on "commitOffsetResponse"', ctx);
        //     try {
        //         // TODO: Should I inform user if there is a gap
        //     } catch (err) {
        //         if (this.attemptPromiseReject) this.attemptPromiseReject(err);
        //         else throw err;
        //     }
        // });

        // this.innerReadStream.events.on('partitionSessionStatusResponse', async (req) => {
        //     try  {
        //         // TODO: Method in partition obj
        //     } catch (err) {
        //         if (this.attemptPromiseReject) this.attemptPromiseReject(err);
        //         else throw err;
        //     }
        // });

        this.innerReadStream.events.on('startPartitionSessionRequest', async (req) => {
            this.logger.trace('%s: on "startPartitionSessionRequest"', ctx);
            try  {
                // TODO: Add partition to the list, and call callbacks at the end
                // Hack: Just confirm
                this.innerReadStream?.startPartitionSessionResponse(ctx, {
                    partitionSessionId: req.partitionSession?.partitionSessionId,
                    // commitOffset ???
                    // readOffset ???
                })
            } catch (err) {
                if (this.attemptPromiseReject) this.attemptPromiseReject(err);
                else throw err;
            }
        });

        // this.innerReadStream.events.on('stopPartitionSessionRequest', async (req) => {
        //     try  {
        //         // TODO: Remove from partions list
        //     } catch (err) {
        //         if (this.attemptPromiseReject) this.attemptPromiseReject(err);
        //         else throw err;
        //     }
        // });

        // this.innerReadStream.events.on('updateTokenResponse', () => {
        //     try  {
        //         if (rev !== this.rev) new Error(`triggered rev ${rev} when stream rev ${this.rev}`);
        //         // TODO: Ensure its ok
        //     } catch (err) {
        //         if (this.attemptPromiseReject) this.attemptPromiseReject(err);
        //         else throw err;
        //     }
        // });

        this.innerReadStream.events.on('error', (error) => {
            try {
                if (this.attemptPromiseReject) this.attemptPromiseReject(error);
                else throw error;
            } catch (err) { // TODO: Looks redundant
                if (this.attemptPromiseReject) this.attemptPromiseReject(err);
                else throw err;
            }
        });

        this.innerReadStream.events.on('end', () => {
            try {
                if (this.attemptPromiseResolve) this.attemptPromiseResolve({});
                delete this.innerReadStream;
            } catch (err) {
                if (this.attemptPromiseReject) this.attemptPromiseReject(err);
                else throw err;
            }
        });
    }

    // @ts-ignore
    public close(force?: boolean): void;
    public close(ctx: Context, force?: boolean): void;
    /**
     * @param force true - stopprocessing immidiatly, without processing messages left in the queue.
     */
    @ensureContext(true)
    public async close(ctx: Context, force?: boolean) {
        if (!this.closingReason) {
            this.closingReason = new Error('close');
            (this.closingReason as any).cause = closeSymbol;
            if (force) {
                this.queue.length = 0; // drop rest of messages
                if (this.waitNextResolve) this.waitNextResolve(undefined);
            }
            await this.innerReadStream!.close(ctx);
        }
    }

    private async closeInnerStream(ctx: Context) {
        if (this.innerReadStream) {
            await this.innerReadStream.close(ctx);
            delete this.innerReadStream;
        }
    }
}
