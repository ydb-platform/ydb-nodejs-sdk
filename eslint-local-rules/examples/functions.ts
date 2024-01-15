import { ContextWithLogger } from '../../src/context-with-logger';
/* eslint local-rules/context: "error" */

class A {
    // constructor() {
    //     // this.logger = {}
    // }

    // private static syncMethod() {
    //     // this.logger.info(123)
    // }

    async asyncMethod() {
        ContextWithLogger.get('ydb-sdk:...eslint-local-rules.examples.A.asyncMethod', this);

        ctx.logger.info(123);
    }

    // protected static syncMethodAsField = () => {
    //
    // }

    // asyncMethodAsField = async () => {
    //     // @ctxDecorator
    // }

    // static get V() {
    //     return 12;
    // }
    //
    // protected set V() {
    //     return 12;
    // }
}

// function syncFunction() {
//     // @ctxDecorator
//
// }

/* @ctxDecorator */
// async function asyncFunction() {
//     /* @ctxDecorator */
//
// }

// /* no name */
// (function () {
//
// })()

// const syncAsVar = () => {
// }

// const asyncAsVar = async () =>
//     /* @ctxRoot */
//     /* @ctxDecorator */
//     () => {
//         ContextWithLogger.get('ydb-sdk:...eslint-local-rules.examples.asyncAsVar');
//     };
