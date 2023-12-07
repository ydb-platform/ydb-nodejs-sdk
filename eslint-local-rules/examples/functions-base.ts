/* eslint local-rules/context: "error" */

class A {
    constructor() {
        // this.logger = {}
    }

    syncMethod() {
        // this.logger.info(123)
    }
    async asyncMethod() {
        // this.logger.info(123)
    }

    syncMethodAsField = () => {

    }

    asyncMethodAsField = () => {

    }
}

function syncFunction() {

}

async function asyncFunction() {

}

/* no name */
(function () {

})()

const syncAsVar = () => {
    // /* decorator */
    // return () => {
    //
    // }
}

const asyncAsVar = async () => {
    /* decorator */
    return () => {

    }
}
