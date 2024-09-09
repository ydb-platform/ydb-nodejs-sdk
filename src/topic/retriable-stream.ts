import {runSymbol, stateSymbol} from "./symbols";

export enum RetriableStreamState {
    Init,
    InitInnerStream,
    Active,


        Closing,
        Closed
}

abstract class RetriableStream<StreamArgs>{




    // [runSymbol](args: StreamArgs) {
    //     try {
    //     // retrier do
    //
    //     //   init inner stream
    //
    //     // do the job
    //
    //
    //
    //
    //
    // }
    //
    // abstract
    //
    // public abstract /*async*/ close(force: boolean /*= false*/);
}
