import _ from 'lodash';
import Long from 'long';
import {google, Ydb} from 'ydb-sdk-proto';
import 'reflect-metadata';

import Type = Ydb.Type;
import IType = Ydb.IType;
import IStructMember = Ydb.IStructMember;
import IValue = Ydb.IValue;
import IColumn = Ydb.IColumn;
import ITypedValue = Ydb.ITypedValue;
import IResultSet = Ydb.IResultSet;
import NullValue = google.protobuf.NullValue;
import PrimitiveTypeId = Ydb.Type.PrimitiveTypeId;


export const typeMetadataKey = Symbol('type');

export function declareType(type: IType) {
    return Reflect.metadata(typeMetadataKey, type);
}

const primitiveTypeToValue: Record<number, string> = {
    [Type.PrimitiveTypeId.BOOL]: 'boolValue',
    [Type.PrimitiveTypeId.INT8]: 'int32Value',
    [Type.PrimitiveTypeId.UINT8]: 'uint32Value',
    [Type.PrimitiveTypeId.INT16]: 'int32Value',
    [Type.PrimitiveTypeId.UINT16]: 'uint32Value',
    [Type.PrimitiveTypeId.INT32]: 'int32Value',
    [Type.PrimitiveTypeId.UINT32]: 'uint32Value',
    [Type.PrimitiveTypeId.INT64]: 'int64Value',
    [Type.PrimitiveTypeId.UINT64]: 'uint64Value',
    [Type.PrimitiveTypeId.FLOAT]: 'floatValue',
    [Type.PrimitiveTypeId.DOUBLE]: 'doubleValue',
    [Type.PrimitiveTypeId.STRING]: 'bytesValue',
    [Type.PrimitiveTypeId.UTF8]: 'textValue',
    [Type.PrimitiveTypeId.YSON]: 'bytesValue',
    [Type.PrimitiveTypeId.JSON]: 'textValue',
    [Type.PrimitiveTypeId.UUID]: 'textValue',
    [Type.PrimitiveTypeId.JSON_DOCUMENT]: 'textValue',

    [Type.PrimitiveTypeId.DATE]: 'uint32Value',
    [Type.PrimitiveTypeId.DATETIME]: 'uint32Value',
    [Type.PrimitiveTypeId.TIMESTAMP]: 'uint64Value',
    [Type.PrimitiveTypeId.INTERVAL]: 'uint64Value',
    [Type.PrimitiveTypeId.TZ_DATE]: 'textValue',
    [Type.PrimitiveTypeId.TZ_DATETIME]: 'textValue',
    [Type.PrimitiveTypeId.TZ_TIMESTAMP]: 'textValue',
};

type primitive = boolean | string | number | Date;

export class Primitive {
    static create(type: Ydb.Type.PrimitiveTypeId, value: primitive): ITypedValue {
        return {
            type: {
                typeId: type
            },
            value: {
                [primitiveTypeToValue[type]]: preparePrimitiveValue(type, value)
            }
        };
    }

    static int8(value: number): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.INT8, value);
    }

    static uint8(value: number): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.UINT8, value);
    }

    static int16(value: number): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.INT16, value);
    }

    static uint16(value: number): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.UINT16, value);
    }

    static int32(value: number): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.INT32, value);
    }

    static uint32(value: number): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.UINT32, value);
    }

    static int64(value: number): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.INT64, value);
    }

    static uint64(value: number): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.UINT64, value);
    }

    static float(value: number): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.FLOAT, value);
    }

    static double(value: number): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.DOUBLE, value);
    }

    static string(value: string): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.STRING, value);
    }

    static utf8(value: string): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.UTF8, value);
    }

    static yson(value: string): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.YSON, value);
    }

    static json(value: string): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.JSON, value);
    }

    static uuid(value: string): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.UUID, value);
    }

    static jsonDocument(value: string): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.JSON_DOCUMENT, value);
    }

    static date(value: Date): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.DATE, value);
    }

    static datetime(value: Date): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.DATETIME, value);
    }

    static timestamp(value: Date): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.TIMESTAMP, value);
    }

    static tzDate(value: Date): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.TZ_DATE, value);
    }

    static tzDatetime(value: Date): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.TZ_DATETIME, value);
    }

    static tzTimestamp(value: Date): ITypedValue {
        return Primitive.create(Type.PrimitiveTypeId.TZ_TIMESTAMP, value);
    }
}

const parseLong = (input: string|number): Long|number => {
   const long = typeof input === 'string' ? Long.fromString(input) : Long.fromNumber(input);
   return long.high ? long : long.low;
};

const valueToNativeConverters: Record<string, (input: string|number) => any> = {
    'boolValue': (input) => Boolean(input),
    'int32Value': (input) => Number(input),
    'uint32Value': (input) => Number(input),
    'int64Value': (input) => parseLong(input),
    'uint64Value': (input) => parseLong(input),
    'floatValue': (input) => Number(input),
    'doubleValue': (input) => Number(input),
    'bytesValue': (input) => Buffer.from(input as string, 'base64').toString(),
    'textValue': (input) => input,
    'nullFlagValue': () => null,
};
function convertPrimitiveValueToNative(type: IType, value: IValue) {
    let label, input;
    for ([label, input] of Object.entries(value)) {
        if (label !== 'items' && label !== 'pairs') {
            break;
        }
    }
    if (!label) {
        throw new Error(`Expected a primitive value, got ${value} instead!`);
    }

    let typeId: PrimitiveTypeId | null = null;
    if (type.optionalType) {
        const innerType = type.optionalType.item;
        if (label === 'nullFlagValue') {
            return null;
        } else if (innerType && innerType.typeId) {
            typeId = innerType.typeId;
        }
    } else if (type.typeId) {
        typeId = type.typeId;
    }
    if (typeId === null) {
        throw new Error(`Got empty typeId, type is ${JSON.stringify(type)}, value is ${JSON.stringify(value)}.`);
    }
    return objectFromValue(typeId, valueToNativeConverters[label](input));
}

function objectFromValue(typeId: PrimitiveTypeId, value: unknown) {
    switch (typeId) {
        case PrimitiveTypeId.DATE:
            return new Date((value as number) * 3600 * 1000 * 24);
        case PrimitiveTypeId.DATETIME:
            return new Date((value as number) * 1000);
        case PrimitiveTypeId.TIMESTAMP:
            return new Date((value as number) / 1000);
        case PrimitiveTypeId.TZ_DATE:
        case PrimitiveTypeId.TZ_DATETIME:
        case PrimitiveTypeId.TZ_TIMESTAMP:
            return new Date(value as string);
        default:
            return value;
    }
}

function preparePrimitiveValue(typeId: PrimitiveTypeId, value: any) {
    switch (typeId) {
        case PrimitiveTypeId.DATE:
            return Number(value) / 3600 / 1000 / 24;
        case PrimitiveTypeId.DATETIME:
            return Number(value) / 1000;
        case PrimitiveTypeId.TIMESTAMP:
            return Number(value) * 1000;
        case PrimitiveTypeId.TZ_DATE:
            return (value as Date).toDateString();
        case PrimitiveTypeId.TZ_DATETIME:
        case PrimitiveTypeId.TZ_TIMESTAMP:
            return (value as Date).toISOString();
        default:
            return value;
    }
}

function typeToValue(type: IType | null | undefined, value: any): IValue {
    if (!type) {
        if (value) {
            throw new Error(`Got no type while the value is ${value}`);
        } else {
            throw new Error('Both type and value are empty');
        }
    } else if (type.typeId) {
        const valueLabel = primitiveTypeToValue[type.typeId];
        if (valueLabel) {
            return {[valueLabel]: preparePrimitiveValue(type.typeId, value)};
        } else {
            throw new Error(`Unknown PrimitiveTypeId: ${type.typeId}`);
        }
    } else if (type.decimalType) {
        const numericValue = BigInt(value);
        const low = numericValue & BigInt('0xffffffffffffffff');
        const hi = numericValue >> BigInt('64');
        return {
            low_128: Long.fromString(low.toString()),
            high_128: Long.fromString(hi.toString())
        }
    } else if (type.optionalType) {
        const innerType = type.optionalType.item;
        if (value !== undefined && value !== null) {
            return typeToValue(innerType, value);
        } else {
            return {
                nullFlagValue: NullValue.NULL_VALUE
            };
        }
    } else if (type.listType) {
        const listType = type.listType;
        return {
            items: _.map(value, (item) => typeToValue(listType.item, item))
        };
    } else if (type.tupleType) {
        const elements = type.tupleType.elements as IType[];
        return {
            items: _.map(value, (item, index: number) => typeToValue(elements[index], item))
        };
    } else if (type.structType) {
        const members = type.structType.members as IStructMember[];
        return {
            items: _.map(value, (item, index: number) => {
                const type = members[index].type;
                return typeToValue(type, item);
            })
        };
    } else if (type.dictType) {
        const keyType = type.dictType.key as IType;
        const payloadType = type.dictType.payload as IType;
        return {
            pairs: _.map(_.entries(value), ([key, value]) => ({
                key: typeToValue(keyType, key),
                payload: typeToValue(payloadType, value)
            }))
        }
    } else if (type.variantType) {
        let variantIndex = -1;
        if (type.variantType.tupleItems) {
            const elements = type.variantType.tupleItems.elements as IType[];
            return {
                items: _.map(value, (item, index: number) => {
                    if (item) {
                        variantIndex = index;
                        return typeToValue(elements[index], item);
                    }
                    return item;
                }),
                variantIndex
            }
        } else if (type.variantType.structItems) {
            const members = type.variantType.structItems.members as IStructMember[];
            return {
                items: _.map(value, (item, index: number)=> {
                    if (item) {
                        variantIndex = index;
                        const type = members[index].type;
                        return typeToValue(type, item);
                    }
                    return item;
                }),
                variantIndex
            }
        }
        throw new Error('Either tupleItems or structItems should be present in VariantType!');
    } else {
        throw new Error(`Unknown type ${type}`);
    }
}

type StringFunction = (name?: string) => string;
export interface NamesConversion {
    ydbToJs: StringFunction;
    jsToYdb: StringFunction;
}

export interface TypedDataOptions {
    namesConversion?: NamesConversion;
}

function assertUnreachable(_c: never): never {
    throw new Error('Should not get here!');
}
function getNameConverter(options: TypedDataOptions, direction: keyof NamesConversion): StringFunction {
    const converter = options.namesConversion?.[direction];
    if (converter) {
        return converter;
    } else { // defaults
        switch (direction) {
            case 'jsToYdb': return _.snakeCase;
            case 'ydbToJs': return _.camelCase;
            default: return assertUnreachable(direction);
        }
    }
}

export function withTypeOptions(options: TypedDataOptions) {
    return function<T extends Function>(constructor: T): T & {__options: TypedDataOptions} {
        return _.merge(constructor, {__options: options});
    }
}

export const snakeToCamelCaseConversion: NamesConversion = {
    jsToYdb: _.snakeCase,
    ydbToJs: _.camelCase,
};
export const identityConversion: NamesConversion = {
    jsToYdb: _.identity,
    ydbToJs: _.identity,
}

export class TypedData {
    [property: string]: any;
    static __options: TypedDataOptions = {};

    constructor(data: Record<string, any>) {
        _.assign(this, data);
    }

    getType(propertyKey: string): IType {
        const typeMeta = Reflect.getMetadata(typeMetadataKey, this, propertyKey);
        if (!typeMeta) {
            throw new Error(`Property ${propertyKey} should be decorated with @declareType!`);
        }
        return typeMeta;
    }

    getValue(propertyKey: string): IValue {
        const type = this.getType(propertyKey);
        return typeToValue(type, this[propertyKey]);
    }

    getTypedValue(propertyKey: string): ITypedValue {
        return {
            type: this.getType(propertyKey),
            value: this.getValue(propertyKey)
        };
    }

    get typedProperties(): string[] {
        return _.filter(Reflect.ownKeys(this), (key) => (
            typeof key === 'string' && Reflect.hasMetadata(typeMetadataKey, this, key)
        )) as string[];
    }

    getRowType() {
        const cls = this.constructor as typeof TypedData;
        const converter = getNameConverter(cls.__options, 'jsToYdb');
        return {
            structType: {
                members: _.map(this.typedProperties, (propertyKey) => ({
                    name: converter(propertyKey),
                    type: this.getType(propertyKey)
                }))
            }
        };
    }

    getRowValue() {
        return {
            items: _.map(this.typedProperties, (propertyKey: string) => {
                return this.getValue(propertyKey)
            })
        }
    }

    static createNativeObjects(resultSet: IResultSet): TypedData[] {
        const {rows, columns} = resultSet;
        if (!columns) {
            return [];
        }
        const converter = getNameConverter(this.__options, 'ydbToJs');
        return _.map(rows, (row) => {
            const obj = _.reduce(row.items, (acc: Record<string, any>, value, index) => {
                const column = columns[index] as IColumn;
                if (column.name && column.type) {
                    acc[converter(column.name)] = convertPrimitiveValueToNative(column.type, value);
                }
                return acc;
            }, {});
            return new this(obj);
        })
    }

    static asTypedCollection(collection: TypedData[]) {
        return {
            type: {
                listType: {
                    item: collection[0].getRowType()
                }
            },
            value: {
                items: collection.map((item) => item.getRowValue())
            }
        }
    }
}
