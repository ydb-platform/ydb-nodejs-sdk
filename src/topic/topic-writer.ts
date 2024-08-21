import {TopicWriteStreamWithEvents, WriteStreamWriteArgs, WriteStreamWriteResult} from "./topic-write-stream-with-events";
import {Ydb} from "ydb-sdk-proto";

export const enum TopicWriterState {
    Init,
    Active,
    Closing,
    Closed
}

type messageQueueItem = {
    opts: WriteStreamWriteArgs,
    resolve: (value: (Ydb.Topic.StreamWriteMessage.IWriteResponse | PromiseLike<Ydb.Topic.StreamWriteMessage.IWriteResponse>)) => void,
    reject: (reason?: any) => void
}

// TODO: is there any better terms instea of writer/reader

export class TopicWriter {
    private _state: TopicWriterState = TopicWriterState.Init;
    private messageQueue: messageQueueItem[] = [];
    private closingReason?: Error;

    public get state() {
        return this._state;
    }

    constructor(private stream: TopicWriteStreamWithEvents) {
        this.stream.events.on('writeResponse', (response) => {
            this.messageQueue.shift()!.resolve(response); // TODO: It's so simple cause retrier is not in place yet
        });
        this.stream.events.on('error', (err) => {
            this.closingReason = err;
            this._state = TopicWriterState.Closing;
            this.messageQueue.forEach((item) => {
                item.reject(err);
            });
        });
    }

    public /*async*/ sendMessages(opts: WriteStreamWriteArgs) {
        if (this._state > TopicWriterState.Active) return Promise.reject(this.closingReason);
        const res = new Promise<WriteStreamWriteResult>((resolve, reject) => {
            this.messageQueue.push({
                opts,
                resolve,
                reject
            })
        });
        this.stream.writeRequest(opts);
        return res;
    }

    public /*async*/ close() {
        // set state
        if (this._state > TopicWriterState.Active) return Promise.reject(this.closingReason);
        this.closingReason = new Error('Closing'); // to have the call stack
        this._state = TopicWriterState.Closing;

        // return a Promise that ensures that inner stream has received all acks and being closed
        let closeResolve: (value: unknown) => void;
        const closePromise = new Promise((resolve) => {
            closeResolve = resolve;
        });
        this.stream.events.once('end', () => {
            this._state = TopicWriterState.Closed;
            closeResolve(undefined);
        });
        return closePromise;
    }
}
