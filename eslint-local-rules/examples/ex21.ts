/* eslint local-rules/context: "error" */

// local -rules/context: trace, no-root

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
        // local-rules/context: no-trace, anonym-trace
        console.info('test');
        super();

        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:...eslint-local-rules.examples.A.constructor', ctx.logger);

        //     // local-rules/context: no-root, no-trace
        //
        // };

        F();
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
