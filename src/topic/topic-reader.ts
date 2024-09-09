import {innerStreamArgsSymbol, innerStreamSymbol, stateSymbol} from "./symbols";
import {
    ReadStreamInitArgs,
    TopicReadStreamWithEvents
} from "./internal/topic-read-stream-with-events";
import {StreamState} from "./stream-state";
import DiscoveryService from "../discovery/discovery-service";
import {RetryLambdaResult, RetryStrategy} from "../retries/retryStrategy";
import {Context} from "../context";
import {Logger} from "../logger/simple-logger";
import {TopicReaderState} from "./simple/topic-reader";

export class TopicReader {
    private _state: StreamState = StreamState.Init;
    private stream?: TopicReadStreamWithEvents;
    private attemptPromise?: Promise<RetryLambdaResult<void>>;
    private attemptPromiseResolve?: (value: (PromiseLike<RetryLambdaResult<void>> | RetryLambdaResult<void>)) => void;
    private attemptPromiseReject?: (value: any) => void;
    private rev = 1;

    private queue: ReadStreamReadResult[] = [];
    private waitNextResolve?: (value: unknown) => void;

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
                        if (self._state > TopicReaderState.Active) return;
                        await new Promise((resolve) => {
                            self.waitNextResolve = resolve;
                        });
                        delete self.waitNextResolve;
                    }
                }
            }
        }
        return this._messages;
    }


    constructor(private streamArgs: ReadStreamInitArgs, private retrier: RetryStrategy, private discovery: DiscoveryService, private logger: Logger) {
    }

    public async init(ctx: Context) {
        await this.retrier.retry(ctx, async () => {
            this.attemptPromise = new Promise<RetryLambdaResult<void>>((resolve, reject) => {
                this.attemptPromiseResolve = resolve;
                this.attemptPromiseReject = reject;
            });
            await this.initInnerStream();
            this.attemptPromise
                .catch((err) => { // all operati ons considered as idempotent
                    return {
                        err: err as Error,
                        idempotent: true
                    }
                })
                .finally(() => {
                    this.closeInnerStream();
                });
            return this.attemptPromise; // wait till stream will be 'closed' or an error, possibly retryable
        });
    }

    private async initInnerStream() {
        if (this.stream) throw new Error('Thetream was not deleted by "end" event')

        const rev = ++this.rev; // temporary protection against overlapping open streams
        this.stream = new TopicReadStreamWithEvents(this.streamArgs, await this.discovery.getTopicNodeClient(), this.logger);

        this.stream.events.on('initResponse', async (resp) => {
            try  {
                if (rev !== this.rev) new Error(`triggered rev ${rev} when stream rev ${this.rev}`);
                // TODO: seqNo only first time
            } catch (err) {
                if (this.attemptPromiseReject) this.attemptPromiseReject(err);
                else throw err;
            }
        });

        this.stream.events.on('readResponse', async (resp) => {
            try  {
                if (rev !== this.rev) new Error(`triggered rev ${rev} when stream rev ${this.rev}`);
                this.queue.push(resp);
                if (this.waitNextResolve) this.waitNextResolve(undefined);
            } catch (err) {
                if (this.attemptPromiseReject) this.attemptPromiseReject(err);
                else throw err;
            }
        });

        this.stream.events.on('commitOffsetResponse', async (req) => {
            try  {
                if (rev !== this.rev) new Error(`triggered rev ${rev} when stream rev ${this.rev}`);
                // TODO: Should I inform user if there is a gap
            } catch (err) {
                if (this.attemptPromiseReject) this.attemptPromiseReject(err);
                else throw err;
            }
        });

        this.stream.events.on('partitionSessionStatusResponse', async (req) => {
            try  {
                if (rev !== this.rev) new Error(`triggered rev ${rev} when stream rev ${this.rev}`);
                // TODO: Method in partition obj
            } catch (err) {
                if (this.attemptPromiseReject) this.attemptPromiseReject(err);
                else throw err;
            }
        });

        this.stream.events.on('startPartitionSessionRequest', async (req) => {
            try  {
                if (rev !== this.rev) new Error(`triggered rev ${rev} when stream rev ${this.rev}`);
                // TODO: Add partition to the list, and call callbacks at the end
            } catch (err) {
                if (this.attemptPromiseReject) this.attemptPromiseReject(err);
                else throw err;
            }
        });

        this.stream.events.on('stopPartitionSessionRequest', async (req) => {
            try  {
                if (rev !== this.rev) new Error(`triggered rev ${rev} when stream rev ${this.rev}`);
                // TODO: Remove from partions list
            } catch (err) {
                if (this.attemptPromiseReject) this.attemptPromiseReject(err);
                else throw err;
            }
        });

        this.stream.events.on('updateTokenResponse', () => {
            try  {
                if (rev !== this.rev) new Error(`triggered rev ${rev} when stream rev ${this.rev}`);
                // TODO: Ensure its ok
            } catch (err) {
                if (this.attemptPromiseReject) this.attemptPromiseReject(err);
                else throw err;
            }
        });

        this.stream.events.on('error', (error) => {
            try  {
                if (rev !== this.rev) new Error(`triggered rev ${rev} when stream rev ${this.rev}`);
                if (this.attemptPromiseReject) this.attemptPromiseReject(error);
                else throw error;
            } catch (err) { // TODO: Looks redundant
                if (this.attemptPromiseReject) this.attemptPromiseReject(err);
                else throw err;
            }
        });

        this.stream.events.on('end', () => {
            try  {
                if (rev !== this.rev) new Error(`triggered rev ${rev} when stream rev ${this.rev}`);
                if (this.attemptPromiseResolve) this.attemptPromiseResolve({});
                this._state = StreamState.Closed;
                delete this.stream;
            } catch (err) {
                 if (this.attemptPromiseReject) this.attemptPromiseReject(err);
                 else throw err;
            }
        });

        this._state = StreamState.Active;
    }

    public async close(force: boolean) {
        if (this.stream) {
            await this.stream.close(force);
        }
    }

    private async closeInnerStream() {
        if (this.stream) {
            await this.stream.close(true);
            delete this.stream;
        }
    }
}
