import { Ydb } from 'ydb-sdk-proto';
import Long from 'long';
import { toLong } from './utils';
import IValue = Ydb.IValue;

const DECIMAL_REGEX = /^-?\d+(\.\d+)?/;

const trimFractionalValue = (value: string) => {
    if (value.includes('.')) {
        // eslint-disable-next-line no-param-reassign
        value = value.replace(/0*$/, '');
        if (value.endsWith('.')) {
            // eslint-disable-next-line no-param-reassign
            value = value.slice(0, Math.max(0, value.length - 1));
        }
    }

    return value;
};

/**
 * Creates 128-bit bigint string from high and low 64-bit numbers.
 * The steps:
 * - convert high and low bits to array of bytes
 * - convert array of bytes to hex string
 * - create bigint from hex string
 */
const toBigIntString = (high: Long, low: Long): string => {
    const isNegative = high.toSigned().isNegative();
    // Array of big-endian unsigned bytes
    let bytes = [...high.toBytesBE(), ...low.toBytesBE()];

    if (isNegative) {
        // See https://en.wikipedia.org/wiki/Two%27s_complement#From_the_ones'_complement

        // Inverse of bytes
        // eslint-disable-next-line no-bitwise
        bytes = bytes.map((b) => ~b + 256);

        // Increment
        let inc = true;

        for (let index = bytes.length - 1; inc && index >= 0; index--) {
            const byte = bytes[index];

            if (byte === 255) {
                bytes[index] = 0;
            } else {
                bytes[index]++;
                inc = false;
            }
        }
        if (inc) {
            bytes.splice(0, 0, 1);
        }
    }
    const hex = `0x${bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    let bigInt = BigInt(hex);

    if (isNegative) {
        bigInt = -bigInt;
    }

    return bigInt.toString();
};

export const toDecimalString = (high: Long | number, low: Long | number, scale: number): string => {
    const str = toBigIntString(toLong(high), toLong(low));
    const isNegative = str.startsWith('-');
    const positiveStr = isNegative ? str.slice(1) : str;
    let scaledPositiveStr;

    if (scale === 0) {
        scaledPositiveStr = positiveStr;
    } else if (positiveStr.length > scale) {
        const dotIndex = positiveStr.length - scale;

        scaledPositiveStr = `${positiveStr.slice(0, Math.max(0, dotIndex))}.${positiveStr.slice(dotIndex)}`;
    } else {
        scaledPositiveStr = `0.${positiveStr.padStart(scale, '0')}`;
    }

    return (isNegative ? '-' : '') + trimFractionalValue(scaledPositiveStr);
};

export const fromDecimalString = (value: string, scale: number): IValue => {
    if (!DECIMAL_REGEX.test(value)) {
        throw new Error(`Incorrect decimal value: ${value}`);
    }
    const [integerPart, fractionalPart = ''] = value.split('.');
    const scaledValue = integerPart + fractionalPart.padEnd(scale, '0');
    const numericValue = BigInt(scaledValue);
    // eslint-disable-next-line no-bitwise
    const low = numericValue & BigInt('0xffffffffffffffff');
    // eslint-disable-next-line no-bitwise
    const hi = numericValue >> BigInt('64');

    return {
        low_128: Long.fromString(low.toString()),
        high_128: Long.fromString(hi.toString()),
    };
};
