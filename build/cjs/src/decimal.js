"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromDecimalString = exports.toDecimalString = void 0;
const long_1 = __importDefault(require("long"));
const utils_1 = require("./utils");
const DECIMAL_REGEX = /^-?\d+(\.\d+)?/;
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
    const isNegative = high.toSigned().isNegative();
    // Array of big-endian unsigned bytes
    let bytes = [...high.toBytesBE(), ...low.toBytesBE()];
    if (isNegative) {
        // See https://en.wikipedia.org/wiki/Two%27s_complement#From_the_ones'_complement
        // Inverse of bytes
        bytes = bytes.map((b) => ~b + 256);
        // Increment
        let inc = true;
        for (let index = bytes.length - 1; inc && index >= 0; index--) {
            const byte = bytes[index];
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
    const hex = '0x' + bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
    let bigInt = BigInt(hex);
    if (isNegative) {
        bigInt = -bigInt;
    }
    return bigInt.toString();
}
function toDecimalString(high, low, scale) {
    const str = toBigIntString((0, utils_1.toLong)(high), (0, utils_1.toLong)(low));
    const isNegative = str.startsWith('-');
    const positiveStr = isNegative ? str.substr(1) : str;
    let scaledPositiveStr;
    if (scale === 0) {
        scaledPositiveStr = positiveStr;
    }
    else if (positiveStr.length > scale) {
        const dotIndex = positiveStr.length - scale;
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
        throw new Error(`Incorrect decimal value: ${value}`);
    }
    const [integerPart, fractionalPart = ''] = value.split('.');
    const scaledValue = integerPart + fractionalPart.padEnd(scale, '0');
    const numericValue = BigInt(scaledValue);
    const low = numericValue & BigInt('0xffffffffffffffff');
    const hi = numericValue >> BigInt('64');
    return {
        low_128: long_1.default.fromString(low.toString()),
        high_128: long_1.default.fromString(hi.toString()),
    };
}
exports.fromDecimalString = fromDecimalString;
