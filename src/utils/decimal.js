"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromDecimalString = exports.toDecimalString = void 0;
var long_1 = require("long");
var to_long_1 = require("./to-long");
var DECIMAL_REGEX = /^-?\d+(\.\d+)?/;
function trimFractionalValue(value) {
    if (value.indexOf('.') >= 0) {
        value = value.replace(/0*$/, '');
        if (value.endsWith('.')) {
            value = value.substr(0, value.length - 1);
        }
    }
    return value;
}
/**
 * Creates 128-bit bigint string from high and low 64-bit numbers.
 * The steps:
 * - convert high and low bits to array of bytes
 * - convert array of bytes to hex string
 * - create bigint from hex string
 */
function toBigIntString(high, low) {
    var isNegative = high.toSigned().isNegative();
    // Array of big-endian unsigned bytes
    var bytes = __spreadArray(__spreadArray([], high.toBytesBE(), true), low.toBytesBE(), true);
    if (isNegative) {
        // See https://en.wikipedia.org/wiki/Two%27s_complement#From_the_ones'_complement
        // Inverse of bytes
        bytes = bytes.map(function (b) { return ~b + 256; });
        // Increment
        var inc = true;
        for (var index = bytes.length - 1; inc && index >= 0; index--) {
            var byte = bytes[index];
            if (byte === 255) {
                bytes[index] = 0;
            }
            else {
                bytes[index]++;
                inc = false;
            }
        }
        if (inc) {
            bytes.splice(0, 0, 1);
        }
    }
    var hex = '0x' + bytes.map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
    var bigInt = BigInt(hex);
    if (isNegative) {
        bigInt = -bigInt;
    }
    return bigInt.toString();
}
function toDecimalString(high, low, scale) {
    var str = toBigIntString((0, to_long_1.toLong)(high), (0, to_long_1.toLong)(low));
    var isNegative = str.startsWith('-');
    var positiveStr = isNegative ? str.substr(1) : str;
    var scaledPositiveStr;
    if (scale === 0) {
        scaledPositiveStr = positiveStr;
    }
    else if (positiveStr.length > scale) {
        var dotIndex = positiveStr.length - scale;
        scaledPositiveStr = positiveStr.substr(0, dotIndex) + '.' + positiveStr.substr(dotIndex);
    }
    else {
        scaledPositiveStr = '0.' + positiveStr.padStart(scale, '0');
    }
    return (isNegative ? '-' : '') + trimFractionalValue(scaledPositiveStr);
}
exports.toDecimalString = toDecimalString;
function fromDecimalString(value, scale) {
    if (!DECIMAL_REGEX.test(value)) {
        throw new Error("Incorrect decimal value: ".concat(value));
    }
    var _a = value.split('.'), integerPart = _a[0], _b = _a[1], fractionalPart = _b === void 0 ? '' : _b;
    var scaledValue = integerPart + fractionalPart.padEnd(scale, '0');
    var numericValue = BigInt(scaledValue);
    var low = numericValue & BigInt('0xffffffffffffffff');
    var hi = numericValue >> BigInt('64');
    return {
        low_128: long_1.default.fromString(low.toString()),
        high_128: long_1.default.fromString(hi.toString()),
    };
}
exports.fromDecimalString = fromDecimalString;
