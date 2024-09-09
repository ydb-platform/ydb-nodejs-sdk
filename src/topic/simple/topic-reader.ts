import {pushReadResponse, streamSymbol} from "./symbols";
import {
    ReadStreamInitArgs,
    ReadStreamReadResult,
    TopicReadStreamWithEvents
} from "./internal/topic-read-stream-with-events";
import {TopicClient} from "./topic-client";

export const enum TopicReaderState {
    Init,
    Active,
    Closing,
    Closed
}

export class ReadStreamReadResultWrapper {

    public readStream: TopicReadStreamWithEvents;

    public commit() {
        // TODO: Make message commit
    }
}
export class TopicReader {
    private _state: TopicReaderState = TopicReaderState.Init;
    private closingReason?: Error;

    private [streamSymbol]: TopicReadStreamWithEvents;

    public get state() {
        return this._state;
    }

    constructor(args: ReadStreamInitArgs, _stream: TopicReadStreamWithEvents) {
        this[streamSymbol] = _stream;
        // this[stream].events.on('initResponse', (response) => {
        //     }
        // });
        // this[stream].events.on('error', (err) => {
        // });
    }

    /**
     * Closes only when all messages in the queue have been successfully sent.
     */
    public /*async*/ close() {
        // set state
        if (this._state > TopicReaderState.Active) return Promise.reject(this.closingReason);
        this.closingReason = new Error('Closing'); // to have the call stack

        // TODO:


        // if (this.messageQueue.length === 0) {
        //     this[stream].close();
        //     this._state = TopicReaderState.Closed;
        //     return Promise.resolve();
        // } else {
        //     this._state = TopicReaderState.Closing;
        //
        //     // return a Promise that ensures that inner stream has received all acks and being closed
        //     let closeResolve: (value: unknown) => void;
        //     const closePromise = new Promise((resolve) => {
        //         closeResolve = resolve; // TODO: Should close return error, if one had to happend on stream?  Ок it should be handled by the retrier
        //     });
        //     this[stream].events.once('end', () => {
        //         this._state = TopicReaderState.Closed;
        //         closeResolve(undefined);
        //     });
        //     return closePromise;
        // }
    }

    private queue: ReadStreamReadResult[] = [];
    private waitNextResolve?: (value: unknown) => void;

    [pushReadResponse](resp: ReadStreamReadResult) {
        this.queue.push(resp);
        if (this.waitNextResolve) this.waitNextResolve(undefined);
    }

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
}
