import {
    InternalReadStreamInitArgs,
    InternalTopicReadStream
} from "./internal/internal-topic-read-stream";
import DiscoveryService from "../discovery/discovery-service";
import {RetryLambdaResult, RetryStrategy} from "../retries/retryStrategy";
import {Context, CtxUnsubcribe, ensureContext} from "../context";
import {Logger} from "../logger/simple-logger";
import {closeSymbol} from "./symbols";
import {google, Ydb} from "ydb-sdk-proto";
import Long from "long";

export class Message {
    // from IReadResponse
    bytesSize?: number | Long | null;

    // from IPartitionData
    partitionSessionId?: number | Long | null;

    // from IBatch
    codec?: number | null;
    producerId?: string | null;
    writeSessionMeta?: { [p: string]: string } | null;
    writtenAt?: google.protobuf.ITimestamp | null;

    // from IMessageData
    createdAt?: google.protobuf.ITimestamp | null;
    data?: Uint8Array | null;
    messageGroupId?: string | null;
    metadataItems?: Ydb.Topic.IMetadataItem[] | null;
    offset?: number | Long | null;
    seqNo?: number | Long | null;
    uncompressedSize?: number | Long | null;

    constructor(
        private innerReader: InternalTopicReadStream,
        partition: Ydb.Topic.StreamReadMessage.ReadResponse.IPartitionData,
        batch: Ydb.Topic.StreamReadMessage.ReadResponse.IBatch,
        message: Ydb.Topic.StreamReadMessage.ReadResponse.IMessageData,
    ) {
        // TODO: Decode
        // TODO: Uint8Array to string ???
        Object.assign(this, partition, batch, message);
        delete (this as any).batches;
        delete (this as any).messageData;
    }

    isCommitPossible() {
        return !!(this.innerReader as any).reasonForClose;
    }

    // @ts-ignore
    public async commit(): Promise<void>;
    public async commit(ctx: Context): Promise<void>;
    @ensureContext(true)
    public async commit(ctx: Context) {
        this.innerReader.logger.trace('%s: TopicReader.commit()', ctx);
        await this.innerReader.commitOffsetRequest(ctx, {
            commitOffsets: [{
                partitionSessionId: this.partitionSessionId,
                offsets: [
                    {
                        start: this.offset || 0,
                        end: Long.fromValue(this.offset || 0).add(1),
                    }
                ]
            }],
        });
        // TODO: Wait for response
    }
}

export class TopicReader {
    private closeResolve?: () => void;
    private reasonForClose?: Error;
    private attemptPromiseReject?: (value: any) => void;
    private queue: Message[] = [];
    private waitNextResolve?: (value: unknown) => void;
    private innerReadStream?: InternalTopicReadStream;
    private closePromise?: Promise<void>;

    private _messages?: { [Symbol.asyncIterator]: () => AsyncGenerator<Message, void> };

    public get messages() {
        this.logger.trace('%s: TopicReader.messages', this.ctx);
        if (!this._messages) {
            const self = this;
            this._messages = {
                async* [Symbol.asyncIterator]() {
                    while (true) {
                        if (self.reasonForClose) {
                            if ((self.reasonForClose as any).cause !== closeSymbol) throw self.reasonForClose;
                            return;
                        }
                        while (self.queue.length > 0) {
                            const msg = self.queue.shift()!
                            if (msg.bytesSize) { // end of single response block
                                self.innerReadStream!.readRequest(self.ctx, {
                                    bytesSize: msg.bytesSize,
                                })
                            }
                            yield msg;
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

    constructor(private ctx: Context, private readStreamArgs: InternalReadStreamInitArgs, private retrier: RetryStrategy, private discovery: DiscoveryService, private logger: Logger) {
        logger.trace('%s: new TopicReader', ctx);
        if (!(readStreamArgs.receiveBufferSizeInBytes > 0)) throw new Error('receivingBufferSize must be greater than 0');
        let onCancelUnsub: CtxUnsubcribe;
        if (ctx.onCancel) onCancelUnsub = ctx.onCancel((_cause) => {
            if (this.reasonForClose) return;
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
                    if (this.waitNextResolve) this.waitNextResolve(undefined);
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
                if (this.waitNextResolve) this.waitNextResolve(undefined);
            })
            .finally(() => {
                if (onCancelUnsub) onCancelUnsub();
            });
    }

    private async initInnerStream(ctx: Context) {
        this.logger.trace('%s: TopicReader.initInnerStream()', ctx);
        this.innerReadStream = new InternalTopicReadStream(ctx, this.readStreamArgs, await this.discovery.getTopicNodeClient(), this.logger);

        // this.innerReadStream.events.on('initResponse', async (resp) => {
        //     try {
        //         // TODO: Impl
        //     } catch (err) {
        //         if (this.attemptPromiseReject) this.attemptPromiseReject(err);
        //         else throw err;
        //     }
        // });

        this.innerReadStream.events.on('readResponse', async (resp) => {
            this.logger.trace('%s: on "readResponse"', ctx);
            try {
                for (const data of resp.partitionData!) {
                    for (const batch of data.batches!) {
                        for (const msg of batch.messageData!) {
                            this.queue.push(new Message(this.innerReadStream!, data, batch, msg));
                            if (this.waitNextResolve) this.waitNextResolve(undefined);
                        }
                    }
                }
                this.queue[this.queue.length - 1].bytesSize = resp.bytesSize; // end of one response messages block
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
        //     this.logger.trace('%s: TopicReader.on "partitionSessionStatusResponse"', ctx);
        //
        //     try  {
        //         // TODO: Method in partition obj
        //     } catch (err) {
        //         if (this.attemptPromiseReject) this.attemptPromiseReject(err);
        //         else throw err;
        //     }
        // });

        this.innerReadStream.events.on('startPartitionSessionRequest', async (req) => {
            this.logger.trace('%s: on "startPartitionSessionRequest"', ctx);
            try {
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
        //     this.logger.trace('%s: TopicReader.on "stopPartitionSessionRequest"', ctx);
        //     try  {
        //         // TODO: Remove from partions list
        //     } catch (err) {
        //         if (this.attemptPromiseReject) this.attemptPromiseReject(err);
        //         else throw err;
        //     }
        // });

        // this.innerReadStream.events.on('updateTokenResponse', () => {
        //     this.logger.trace('%s: TopicReader.on "updateTokenResponse"', ctx);
        //     try  {
        //         // TODO: Ensure its ok
        //     } catch (err) {
        //         if (this.attemptPromiseReject) this.attemptPromiseReject(err);
        //         else throw err;
        //     }
        // });

        this.innerReadStream.events.on('error', (error) => {
            this.logger.trace('%s: TopicReader.on "error"', ctx);
            if (this.attemptPromiseReject) this.attemptPromiseReject(error);
            else throw error;
        });

        this.innerReadStream.events.on('end', (reason) => {
            this.logger.trace('%s: TopicReader.on "end": %o', ctx, reason);
            try {
                this.queue.length = 0; // drp messages queue
                delete this.innerReadStream;
                if (this.closeResolve) this.closeResolve();
            } catch (err) {
                if (this.attemptPromiseReject) this.attemptPromiseReject(err);
                else throw err;
            }
        });

        this.innerReadStream.readRequest(ctx, {
            bytesSize: this.readStreamArgs.receiveBufferSizeInBytes,
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
        this.logger.trace('%s: TopicReader.close()', ctx);
        if (!this.reasonForClose) {
            this.reasonForClose = new Error('close');
            (this.reasonForClose as any).cause = closeSymbol;
            if (force) {
                this.queue.length = 0; // drop rest of messages
                if (this.waitNextResolve) this.waitNextResolve(undefined);
            } else {
                this.closePromise = new Promise<void>((resolve) => {
                    this.closeResolve = resolve;
                });
            }
            await this.innerReadStream!.close(ctx);
        }
        return this.closePromise;
    }

    private async closeInnerStream(ctx: Context) {
        this.logger.trace('%s: TopicReader.closeInnerStream()', ctx);
        if (this.innerReadStream) {
            await this.innerReadStream.close(ctx);
            delete this.innerReadStream;
        }
    }
}
