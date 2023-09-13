import { Ydb } from 'ydb-sdk-proto';
import IValue = Ydb.IValue;
export declare function uuidToValue(value: string): IValue;
export declare function uuidToNative(value: IValue): string;
