/* eslint local-rules/context: "error" */

console.info(12);

/**
 * @decorator
 */
const Retryable = () => {
    return /* @decorator */ function T() {}
};

/**
 * @decorator
 */
export /* @decorator */ function A() {

}
