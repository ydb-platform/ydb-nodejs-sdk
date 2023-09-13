import { Ydb } from 'ydb-sdk-proto';
import Long from 'long';
import IValue = Ydb.IValue;
export declare function toDecimalString(high: Long | number, low: Long | number, scale: number): string;
export declare function fromDecimalString(value: string, scale: number): IValue;
