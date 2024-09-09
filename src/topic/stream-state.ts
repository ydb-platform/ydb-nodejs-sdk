import {StreamState} from "./topic-reader";

export const enum StreamState {
    Init,
    Active,
    Closing,
    Closed
}
