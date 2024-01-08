/* eslint local-rules/context: "error" */

// local-rules/context: trace, no-root

class A {

    // local-rules/context: trace

    b = async () => {
        // local-rules/context: no-trace, no-root
        F();
        // aaa
    }

    t = () =>
        // local-rules/context: trace, no-root, anonym-trace, aaaa
        12;

//     constructor() {
//         // local-rules/context: trace, anonym-trace, aaaa, no-root
//         super(); // ctx must go only after
//         this.logger = function() {
//             // local-rules/context: root, no-trace
//
//         }
//     }
//
//     // n() {
//     //     // local-rules/context: no-trace, root1
//     //     // local-rules/context: no-trace, root2
//     //     this.logger.info(123);
//     //     // local-rules/context: no-trace, root3
//     //     function Q() {
//     //         // local-rules/context: no-trace, root4
//     //     }
//     // }
//
//     // q: () => // TODO: not supported
//     //     // local-rules/context: no-trace, root1
//     //     12;
//
//     // q2: () => {
//     //     return 21;
//     // }
}

// async function a() {
//     // local-rules/context: no-trace, no-root
//     F();
//     // aaa
// }

// const b = async () => {
// // local-rules/context: trace, root
//     F();
//     // aaa
// }
