/* eslint local-rules/context: "error" */

// local-rules/context: no-trace, root

class A {
    // constructor() {
    //     // local-rules/context: trace
    //     super(); // ctx must go only after
    //     this.logger = {}
    // }

    // n() {
    //     // local-rules/context: no-trace, root1
    //     // local-rules/context: no-trace, root2
    //     this.logger.info(123);
    //     // local-rules/context: no-trace, root3
    //     function Q() {
    //         // local-rules/context: no-trace, root4
    //     }
    // }

    q: () => // TODO: not supported
        // local-rules/context: no-trace, root1
        12;
}
