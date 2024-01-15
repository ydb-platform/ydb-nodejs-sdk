/* eslint local-rules/context: "error" */

// local -rules/context: trace, no-root
import { ContextWithLogger } from '../../src/context-with-logger';

class A {
    // local-rules/context: trace

    //     b = async () => {
    //         F();
    //         // aaa
    //     };

    // t = () =>
    //     // local-rules/context: trace, no-root, anonym-trace, aaaa
    //     12;

    constructor() {
        // local-rules/context: trace anonym-trace

        // console.info('test');
        // super();
        const ctx = ContextWithLogger.get('ydb-nodejs-sdk:...eslint-local-rules.examples.A.constructor', '<logger>');

        console.info(2000, ctx.doSync(() => await(() => {
            F();
        }))());

        // const WW = () => {
        //     // local-rules/context: root trace
        //     const ctx = ContextWithLogger.get('ydb-nodejs-sdk:...eslint-local-rules.examples.A.constructor.WW');
        //
        //     ctx.doSync(() => t());
        // };

        //     // local-rules/context: no-root, no-trace
        //
        // };

        // ctx.doSync(() => F());
    }

    // n() {
    //     // local-rules/context: no-trace, root1
    //     // local-rules/context: no-trace, root2
    //     this.logger.info(123);
    //     // local-rules/context: no-trace, root3
    //     function Q() {
    //         // local-rules/context: no-trace, root4
    //     }
    // }

//     // q: () => // TODO: not supported
//     //     // local-rules/context: no-trace, root1
//     //     12;
//
//     // q2: () => {
//     //     return 21;
//     // }
}

// const a = async () => {
//     // local-rules/context: trace, root
//     await Q();
//     // aaa
// };

// const b = async () => {
//     // local-rules/context: trace, root
//     F();
//     // aaa
// }
