import { Ydb } from 'ydb-sdk-proto';
import * as uuid from 'uuid';
import Long from 'long';
import IValue = Ydb.IValue;
import { toLong } from './to-long';

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

const UUID_REGEX = /^[\dA-Fa-f]{8}(?:-[\dA-Fa-f]{4}){3}-[\dA-Fa-f]{12}$/;

export const uuidToValue = (value: string): IValue => {
    if (!UUID_REGEX.test(value)) {
        throw new Error(`Incorrect UUID value: ${value}`);
    }
    // @ts-ignore
    const uuidBytes = [...uuid.parse(value)] as number[];
    const highBytes = uuidBytes.slice(8, 16);
    const timeLowBytes = uuidBytes.slice(0, 4);
    const timeMidBytes = uuidBytes.slice(4, 6);
    const timeHiAndVersionBytes = uuidBytes.slice(6, 8);
    const lowBytes = [...timeHiAndVersionBytes, ...timeMidBytes, ...timeLowBytes];

    return {
        high_128: Long.fromBytesLE(highBytes, true),
        low_128: Long.fromBytesBE(lowBytes, true),
    };
};

export const uuidToNative = (value: IValue): string => {
    const high = toLong(value.high_128 as number | Long);
    const low = toLong(value.low_128 as number | Long);

    const highBytes = high.toBytesLE();
    const lowBytes = low.toBytesBE();
    const timeLowBytes = lowBytes.slice(4, 8);
    const timeMidBytes = lowBytes.slice(2, 4);
    const timeHighAndVersionBytes = lowBytes.slice(0, 2);
    const uuidBytes = [...timeLowBytes, ...timeMidBytes, ...timeHighAndVersionBytes, ...highBytes];

    return uuid.stringify(uuidBytes);
};
