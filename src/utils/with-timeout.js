"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTimeout = void 0;
var errors_1 = require("../errors");
function withTimeout(promise, timeoutMs) {
    var timeoutId;
    var timedRejection = new Promise(function (_, reject) {
        timeoutId = setTimeout(function () {
            reject(new errors_1.TimeoutExpired("Timeout of ".concat(timeoutMs, "ms has expired")));
        }, timeoutMs);
    });
    return Promise.race([promise.finally(function () {
            clearTimeout(timeoutId);
        }), timedRejection]);
}
exports.withTimeout = withTimeout;
