import Long from 'long';

export const toLong = (value: Long | number): Long => {
    if (typeof value === 'number') {
        return Long.fromNumber(value);
    }

    return value;
};
