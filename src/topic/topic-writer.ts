import {
    TopicWriteStreamWithEvents, WriteStreamInitArgs,
    WriteStreamWriteArgs,
    WriteStreamWriteResult
} from "./internal/topic-write-stream-with-events";
import {Ydb} from "ydb-sdk-proto";
import Long from "long";

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

// TODO: is there any better terms instea of writer/reader

export class TopicWriter {
    private _state: TopicWriterState = TopicWriterState.Init;
    private messageQueue: messageQueueItem[] = [];
    private closingReason?: Error;
    private getLastSeqNo?: boolean; // true if client to proceed sequence based on last known seqNo
    private lastSeqNo?: Long.Long;

    public get state() {
        return this._state;
    }

    constructor(args: WriteStreamInitArgs, private stream: TopicWriteStreamWithEvents) {
        if (args.getLastSeqNo) this.getLastSeqNo = true;
        this.stream.events.on('initResponse', (response) => {
            console.info(1100, response);
            if (this.getLastSeqNo) {
                this.lastSeqNo = (response.lastSeqNo || response.lastSeqNo === 0) ? Long.fromValue(response.lastSeqNo) : Long.fromValue(1);
                this.messageQueue.forEach((queueItem) => {
                    queueItem.sendMessagesOpts.messages?.forEach((msg) => {
                        msg.seqNo = this.lastSeqNo = this.lastSeqNo!.add(1);
                    });
                    this.stream.writeRequest(queueItem.sendMessagesOpts);
                });
            }
        });
        this.stream.events.on('writeResponse', (response) => {
            this.messageQueue.shift()!.resolve(response); // TODO: It's so simple cause retrier is not in place yet
            if (this._state === TopicWriterState.Closing && this.messageQueue.length === 0) {
                this.stream.close();
                this._state = TopicWriterState.Closed;
            }
        });
        this.stream.events.on('error', (err) => {
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
                if (!(msg.seqNo === undefined || msg.seqNo === null)) throw new Error('Writer was created with lastSeqNo = true, explicit seqNo not supported');
                if (this.lastSeqNo) { // else wait till initResponse will be received
                    msg.seqNo = this.lastSeqNo = this.lastSeqNo.add(1);
                    this.stream.writeRequest(args);
                }
            } else {
                if (msg.seqNo === undefined || msg.seqNo === null) throw new Error('Writer was created without lastSeqNo = true, explicit seqNo must be provided');
                this.stream.writeRequest(args);
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
        if (this._state > TopicWriterState.Active) return Promise.reject(this.closingReason);
        this.closingReason = new Error('Closing'); // to have the call stack

        if (this.messageQueue.length === 0) {
            this.stream.close();
            this._state = TopicWriterState.Closed;
            return Promise.resolve();
        } else {
            this._state = TopicWriterState.Closing;

            // return a Promise that ensures that inner stream has received all acks and being closed
            let closeResolve: (value: unknown) => void;
            const closePromise = new Promise((resolve) => {
                closeResolve = resolve;
            });
            //
            this.stream.events.once('end', () => {
                this._state = TopicWriterState.Closed;
                closeResolve(undefined);
            });
            return closePromise;
        }
    }
}
