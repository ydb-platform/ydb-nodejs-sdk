/* eslint local-rules/context: "error" */

class A {
    constructor() {
        this.logger = {}
    }

    n() {
        this.logger.info(123)
    }
}
