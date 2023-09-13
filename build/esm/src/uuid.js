"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uuidToNative = exports.uuidToValue = void 0;
const uuid = __importStar(require("uuid"));
const long_1 = __importDefault(require("long"));
const utils_1 = require("./utils");
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
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function uuidToValue(value) {
    if (!UUID_REGEX.test(value)) {
        throw new Error(`Incorrect UUID value: ${value}`);
    }
    const uuidBytes = Array.from(uuid.parse(value));
    const highBytes = uuidBytes.slice(8, 16);
    const timeLowBytes = uuidBytes.slice(0, 4);
    const timeMidBytes = uuidBytes.slice(4, 6);
    const timeHiAndVersionBytes = uuidBytes.slice(6, 8);
    const lowBytes = [...timeHiAndVersionBytes, ...timeMidBytes, ...timeLowBytes];
    return {
        high_128: long_1.default.fromBytesLE(highBytes, true),
        low_128: long_1.default.fromBytesBE(lowBytes, true),
    };
}
exports.uuidToValue = uuidToValue;
function uuidToNative(value) {
    const high = (0, utils_1.toLong)(value.high_128);
    const low = (0, utils_1.toLong)(value.low_128);
    const highBytes = high.toBytesLE();
    const lowBytes = low.toBytesBE();
    const timeLowBytes = lowBytes.slice(4, 8);
    const timeMidBytes = lowBytes.slice(2, 4);
    const timeHighAndVersionBytes = lowBytes.slice(0, 2);
    const uuidBytes = [...timeLowBytes, ...timeMidBytes, ...timeHighAndVersionBytes, ...highBytes];
    return uuid.stringify(uuidBytes);
}
exports.uuidToNative = uuidToNative;
