"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureCallSucceeded = exports.ensureOperationSucceeded = exports.getOperationPayload = void 0;
var errors_1 = require("../errors");
function getOperationPayload(response) {
    var _a;
    var operation = response.operation;
    if (operation) {
        errors_1.YdbError.checkStatus(operation);
        var value = (_a = operation === null || operation === void 0 ? void 0 : operation.result) === null || _a === void 0 ? void 0 : _a.value;
        if (!value) {
            throw new errors_1.MissingValue('Missing operation result value!');
        }
        return value;
    }
    else {
        throw new errors_1.MissingOperation('No operation in response!');
    }
}
exports.getOperationPayload = getOperationPayload;
function ensureOperationSucceeded(response, suppressedErrors) {
    if (suppressedErrors === void 0) { suppressedErrors = []; }
    try {
        getOperationPayload(response);
    }
    catch (error) {
        var e = error;
        if (suppressedErrors.indexOf(e.constructor.status) > -1) {
            return;
        }
        if (!(e instanceof errors_1.MissingValue)) {
            throw e;
        }
    }
}
exports.ensureOperationSucceeded = ensureOperationSucceeded;
function ensureCallSucceeded(response, suppressedErrors) {
    if (suppressedErrors === void 0) { suppressedErrors = []; }
    try {
        errors_1.YdbError.checkStatus(response);
    }
    catch (error) {
        var e = error;
        if (!(suppressedErrors.indexOf(e.constructor.status) > -1 || e instanceof errors_1.MissingValue)) {
            throw e;
        }
    }
    return response;
}
exports.ensureCallSucceeded = ensureCallSucceeded;
