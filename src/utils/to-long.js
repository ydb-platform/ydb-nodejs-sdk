"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toLong = void 0;
var long_1 = require("long");
function toLong(value) {
    if (typeof value === 'number') {
        return long_1.default.fromNumber(value);
    }
    return value;
}
exports.toLong = toLong;
