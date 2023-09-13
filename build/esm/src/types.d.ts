/// <reference types="node" />
import Long from 'long';
import { Ydb } from 'ydb-sdk-proto';
import 'reflect-metadata';
import IType = Ydb.IType;
import IValue = Ydb.IValue;
import ITypedValue = Ydb.ITypedValue;
import IResultSet = Ydb.IResultSet;
export declare const typeMetadataKey: unique symbol;
export declare function declareType(type: IType): {
    (target: Function): void;
    (target: Object, propertyKey: string | symbol): void;
};
export declare const primitiveTypeToValue: Record<number, string>;
export declare type StructFields = Record<string, IType>;
export declare class Types {
    static BOOL: IType;
    static INT8: IType;
    static UINT8: IType;
    static INT16: IType;
    static UINT16: IType;
    static INT32: IType;
    static UINT32: IType;
    static INT64: IType;
    static UINT64: IType;
    static FLOAT: IType;
    static DOUBLE: IType;
    static BYTES: IType;
    static UTF8: IType;
    static TEXT: IType;
    static YSON: IType;
    static JSON: IType;
    static UUID: IType;
    static JSON_DOCUMENT: IType;
    static DATE: IType;
    static DATETIME: IType;
    static TIMESTAMP: IType;
    static INTERVAL: IType;
    static TZ_DATE: IType;
    static TZ_DATETIME: IType;
    static TZ_TIMESTAMP: IType;
    static DYNUMBER: IType;
    static VOID: IType;
    static DEFAULT_DECIMAL: IType;
    static optional(type: IType): IType;
    /**
     * A real number with the specified precision, up to 35 decimal digits
     * @param precision Total number of decimal places (up to 35, inclusive).
     * @param scale Number of places after the decimal point (out of the total number, meaning it can't be larger than the previous argument)
     */
    static decimal(precision: number, scale: number): IType;
    static tuple(...types: IType[]): IType;
    static list(type: IType): IType;
    static struct(fields: StructFields): IType;
    static dict(key: IType, payload: IType): IType;
    static variant(type: IType): IType;
}
export declare class TypedValues {
    private static primitive;
    static VOID: ITypedValue;
    static fromNative(type: Ydb.IType, value: any): ITypedValue;
    static bool(value: boolean): ITypedValue;
    static int8(value: number): ITypedValue;
    static uint8(value: number): ITypedValue;
    static int16(value: number): ITypedValue;
    static uint16(value: number): ITypedValue;
    static int32(value: number): ITypedValue;
    static uint32(value: number): ITypedValue;
    static int64(value: number | Long): ITypedValue;
    static uint64(value: number | Long): ITypedValue;
    static float(value: number): ITypedValue;
    static double(value: number): ITypedValue;
    static bytes(value: Buffer): ITypedValue;
    static utf8(value: string): ITypedValue;
    static text(value: string): ITypedValue;
    static yson(value: Buffer): ITypedValue;
    static json(value: string): ITypedValue;
    static uuid(value: string): ITypedValue;
    static jsonDocument(value: string): ITypedValue;
    static date(value: Date): ITypedValue;
    static datetime(value: Date): ITypedValue;
    static timestamp(value: Date): ITypedValue;
    static interval(value: number): ITypedValue;
    static tzDate(value: Date): ITypedValue;
    static tzDatetime(value: Date): ITypedValue;
    static tzTimestamp(value: Date): ITypedValue;
    static dynumber(value: string): ITypedValue;
    static optional(value: Ydb.ITypedValue): Ydb.ITypedValue;
    static optionalNull(type: Ydb.IType): Ydb.ITypedValue;
    static decimal(value: string, precision?: number, scale?: number): ITypedValue;
    static tuple(...values: Ydb.ITypedValue[]): Ydb.ITypedValue;
    static list(type: Ydb.IType, values: any[]): Ydb.ITypedValue;
    static struct(fields: StructFields, struct: any): Ydb.ITypedValue;
    static dict(key: Ydb.IType, payload: Ydb.IType, dict: Record<any, any>): Ydb.ITypedValue;
}
export declare function convertYdbValueToNative(type: IType, value: IValue): any;
export declare type StringFunction = (name?: string) => string;
export interface NamesConversion {
    ydbToJs: StringFunction;
    jsToYdb: StringFunction;
}
export interface TypedDataOptions {
    namesConversion?: NamesConversion;
}
export declare function getNameConverter(options: TypedDataOptions, direction: keyof NamesConversion): StringFunction;
export declare function withTypeOptions(options: TypedDataOptions): <T extends Function>(constructor: T) => T & {
    __options: TypedDataOptions;
};
export declare const snakeToCamelCaseConversion: NamesConversion;
export declare const identityConversion: NamesConversion;
export declare class TypedData {
    [property: string]: any;
    static __options: TypedDataOptions;
    constructor(data: Record<string, any>);
    getType(propertyKey: string): IType;
    getValue(propertyKey: string): IValue;
    getTypedValue(propertyKey: string): ITypedValue;
    get typedProperties(): string[];
    getRowType(): {
        structType: {
            members: {
                name: string;
                type: Ydb.IType;
            }[];
        };
    };
    getRowValue(): {
        items: Ydb.IValue[];
    };
    static createNativeObjects(resultSet: IResultSet): TypedData[];
    static asTypedCollection(collection: TypedData[]): ITypedValue;
}
