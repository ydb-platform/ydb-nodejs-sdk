// import {Logger} from "../logging";
//
// const CancelPromise = Symbol('CancelPromise');
//
// class Context {
//     withId(id:)
//     withValue
//     witghCancel
//     withTimeout()
//     cancel(),
//     getValue(name: string, type: function),
//
// }
//
//
//
// class SomeContext /*extends Context*/ {
//
//     constructor(opts: {
//         id?,
//         ctx?: SomeContext, // parent context
//         timeout?: number, // fluxon duration
//         // cancellable?: boolean,
//         // requestId?: string,
//         logger?: Logger,
//         // something about spans
//     } = {}) {
//
//
//
//
//
//         // ensure logger
//     }
//
//     cancel() {
//
//     }
//
//
//     [CancelPromise]?: Promise<void>;
//
//
//     get cancelPromise() {
//         return this[CancelPromise];
//     }
// }
