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
exports.uuidToNative = exports.uuidToValue = void 0;
var uuid = require("uuid");
var long_1 = require("long");
var to_long_1 = require("./utils/to-long");
/**
 * Every UUID string value represents as hex digits displayed in five groups separated by hyphens:
 * - time_low - 8 digits;
 * - time_mid - 4 digits;
 * - time_hi_and_version - 4 digits;
 * - time_high (clock_seq_hi_and_res clock_seq_low (4) + node (12)) - 16 digits.
 *
 * Example: `00112233-4455-5677-ab89-aabbccddeeff`
 * - time_low: `00112233`
 * - time_mid: `4455`
 * - time_hi_and_version: `5677`
 * - time_high: `ab89-aabbccddeeff`
 *
 * The byte representation of UUID v2 value is first three parts in LE format and last two parts in BE format.
 * Example: UUID: `00112233-4455-5677-ab89-aabbccddeeff` byte representation is
 * `33 22 11 00 55 44 77 56 ab 99 aa bb cc dd ee ff`.
 */
var UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function uuidToValue(value) {
    if (!UUID_REGEX.test(value)) {
        throw new Error("Incorrect UUID value: ".concat(value));
    }
    var uuidBytes = Array.from(uuid.parse(value));
    var highBytes = uuidBytes.slice(8, 16);
    var timeLowBytes = uuidBytes.slice(0, 4);
    var timeMidBytes = uuidBytes.slice(4, 6);
    var timeHiAndVersionBytes = uuidBytes.slice(6, 8);
    var lowBytes = __spreadArray(__spreadArray(__spreadArray([], timeHiAndVersionBytes, true), timeMidBytes, true), timeLowBytes, true);
    return {
        high_128: long_1.default.fromBytesLE(highBytes, true),
        low_128: long_1.default.fromBytesBE(lowBytes, true),
    };
}
exports.uuidToValue = uuidToValue;
function uuidToNative(value) {
    var high = (0, to_long_1.toLong)(value.high_128);
    var low = (0, to_long_1.toLong)(value.low_128);
    var highBytes = high.toBytesLE();
    var lowBytes = low.toBytesBE();
    var timeLowBytes = lowBytes.slice(4, 8);
    var timeMidBytes = lowBytes.slice(2, 4);
    var timeHighAndVersionBytes = lowBytes.slice(0, 2);
    var uuidBytes = __spreadArray(__spreadArray(__spreadArray(__spreadArray([], timeLowBytes, true), timeMidBytes, true), timeHighAndVersionBytes, true), highBytes, true);
    return uuid.stringify(uuidBytes);
}
exports.uuidToNative = uuidToNative;
