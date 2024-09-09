import {
    TopicWriteStreamWithEvents, WriteStreamInitArgs,
    WriteStreamWriteArgs,
    WriteStreamWriteResult
} from "./internal/topic-write-stream-with-events";
import {Ydb} from "ydb-sdk-proto";
import Long from "long";
import {streamSymbol} from "./symbols";

export const enum TopicWriterState {
    Init,
    Active,
    Closing,
    Closed
}

type messageQueueItem = {
    sendMessagesOpts: WriteStreamWriteArgs,
    resolve: (value: (Ydb.Topic.StreamWriteMessage.IWriteResponse | PromiseLike<Ydb.Topic.StreamWriteMessage.IWriteResponse>)) => void,
    reject: (reason?: any) => void
}

export class TopicWriter {
    private _state: TopicWriterState = TopicWriterState.Init;
    private messageQueue: messageQueueItem[] = [];
    private closingReason?: Error;
    private getLastSeqNo?: boolean; // true if client to proceed sequence based on last known seqNo
    private lastSeqNo?: Long.Long;

    private [streamSymbol]: TopicWriteStreamWithEvents;

    public get state() {
        return this._state;
    }

    constructor(args: WriteStreamInitArgs, _stream: TopicWriteStreamWithEvents) {
        this[streamSymbol] = _stream;
        this.getLastSeqNo = !!args.getLastSeqNo;
        this[streamSymbol].events.on('initResponse', (response) => {
            console.info(1100, response);
            if (this.getLastSeqNo) {
                this.lastSeqNo = (response.lastSeqNo || response.lastSeqNo === 0) ? Long.fromValue(response.lastSeqNo) : Long.fromValue(1);
                this.messageQueue.forEach((queueItem) => {
                    queueItem.sendMessagesOpts.messages?.forEach((msg) => {
                        msg.seqNo = this.lastSeqNo = this.lastSeqNo!.add(1);
                    });
                    this[streamSymbol].writeRequest(queueItem.sendMessagesOpts);
                });
            }
        });
        this[streamSymbol].events.on('writeResponse', (response) => {
            this.messageQueue.shift()!.resolve(response); // TODO: It's so simple cause retrier is not in place yet
            if (this._state === TopicWriterState.Closing && this.messageQueue.length === 0) {
                this[streamSymbol].close();
                this._state = TopicWriterState.Closed;
            }
        });
        this[streamSymbol].events.on('error', (err) => {
            this.closingReason = err;
            this._state = TopicWriterState.Closing;
            this.messageQueue.forEach((item) => {
                item.reject(err);
            });
        });
    }

    public /*async*/ sendMessages(args: WriteStreamWriteArgs) {
        if (this._state > TopicWriterState.Active) return Promise.reject(this.closingReason);
        console.info(1000, args)
        switch (args.codec) {
            case Ydb.Topic.Codec.CODEC_RAW:
                break;
            default:
                throw new Error(`Codec ${args.codec ? `Ydb.Topic.Codec[opts.codec] (${args.codec})` : args.codec} is not yet supported`);
        }
        args.messages?.forEach((msg) => {
            if (this.getLastSeqNo) {
                if (!(msg.seqNo === undefined || msg.seqNo === null)) throw new Error('Writer was created with getLastSeqNo = true, explicit seqNo not supported');
                if (this.lastSeqNo) { // else wait till initResponse will be received
                    msg.seqNo = this.lastSeqNo = this.lastSeqNo.add(1);
                    this[streamSymbol].writeRequest(args);
                }
            } else {
                if (msg.seqNo === undefined || msg.seqNo === null) throw new Error('Writer was created without getLastSeqNo = true, explicit seqNo must be provided');
                this[streamSymbol].writeRequest(args);
            }
        });
        return new Promise<WriteStreamWriteResult>((resolve, reject) => {
            this.messageQueue.push({
                sendMessagesOpts: args,
                resolve,
                reject
            })
        });
    }

    /**
     * Closes only when all messages in the queue have been successfully sent.
     */
    public /*async*/ close() {
        // set state
        if (this._state > TopicWriterState.Active) return Promise.resolve(this.closingReason);
        this.closingReason = new Error('Closing'); // to have the call stack

        if (this.messageQueue.length === 0) {
            this[streamSymbol].close();
            this._state = TopicWriterState.Closed;
            return Promise.resolve();
        } else {
            this._state = TopicWriterState.Closing;

            // return a Promise that ensures that inner stream has received all acks and being closed
            let closeResolve: (value: unknown) => void;
            const closePromise = new Promise((resolve) => {
                closeResolve = resolve; // TODO: Should close return error, if one had to happend on stream?  Ок it should be handled by the retrier
            });
            this[streamSymbol].events.once('end', () => {
                this._state = TopicWriterState.Closed;
                closeResolve(undefined);
            });
            return closePromise;
        }
    }
}
