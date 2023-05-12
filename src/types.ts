import _ from 'lodash';
import Long from 'long';
import {google, Ydb} from 'ydb-sdk-proto';
import 'reflect-metadata';
import {DateTime} from 'luxon';
import {uuidToNative, uuidToValue} from './uuid';
import {fromDecimalString, toDecimalString} from './decimal';
import Type = Ydb.Type;
import IType = Ydb.IType;
import IStructMember = Ydb.IStructMember;
import IValue = Ydb.IValue;
import IColumn = Ydb.IColumn;
import ITypedValue = Ydb.ITypedValue;
import IResultSet = Ydb.IResultSet;
import PrimitiveTypeId = Ydb.Type.PrimitiveTypeId;
import NullValue = google.protobuf.NullValue;

export const typeMetadataKey = Symbol('type');

export function declareType(type: IType) {
    return Reflect.metadata(typeMetadataKey, type);
}

export const primitiveTypeToValue: Record<number, string> = {
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
    [Type.PrimitiveTypeId.JSON_DOCUMENT]: 'textValue',
    [Type.PrimitiveTypeId.DYNUMBER]: 'textValue',
    [Type.PrimitiveTypeId.DATE]: 'uint32Value',
    [Type.PrimitiveTypeId.DATETIME]: 'uint32Value',
    [Type.PrimitiveTypeId.TIMESTAMP]: 'uint64Value',
    [Type.PrimitiveTypeId.INTERVAL]: 'int64Value',
    [Type.PrimitiveTypeId.TZ_DATE]: 'textValue',
    [Type.PrimitiveTypeId.TZ_DATETIME]: 'textValue',
    [Type.PrimitiveTypeId.TZ_TIMESTAMP]: 'textValue',
};

type primitive = boolean | string | number | Long | Date | Buffer;

export type StructFields = Record<string, IType>;

export class Types {
    static BOOL: IType = {typeId: Ydb.Type.PrimitiveTypeId.BOOL};
    static INT8: IType = {typeId: Ydb.Type.PrimitiveTypeId.INT8};
    static UINT8: IType = {typeId: Ydb.Type.PrimitiveTypeId.UINT8};
    static INT16: IType = {typeId: Ydb.Type.PrimitiveTypeId.INT16};
    static UINT16: IType = {typeId: Ydb.Type.PrimitiveTypeId.UINT16};
    static INT32: IType = {typeId: Ydb.Type.PrimitiveTypeId.INT32};
    static UINT32: IType = {typeId: Ydb.Type.PrimitiveTypeId.UINT32};
    static INT64: IType = {typeId: Ydb.Type.PrimitiveTypeId.INT64};
    static UINT64: IType = {typeId: Ydb.Type.PrimitiveTypeId.UINT64};
    static FLOAT: IType = {typeId: Ydb.Type.PrimitiveTypeId.FLOAT};
    static DOUBLE: IType = {typeId: Ydb.Type.PrimitiveTypeId.DOUBLE};
    static BYTES: IType = {typeId: Ydb.Type.PrimitiveTypeId.STRING};
    static UTF8: IType = {typeId: Ydb.Type.PrimitiveTypeId.UTF8};
    static TEXT: IType = {typeId: Ydb.Type.PrimitiveTypeId.UTF8};
    static YSON: IType = {typeId: Ydb.Type.PrimitiveTypeId.YSON};
    static JSON: IType = {typeId: Ydb.Type.PrimitiveTypeId.JSON};
    static UUID: IType = {typeId: Ydb.Type.PrimitiveTypeId.UUID};
    static JSON_DOCUMENT: IType = {typeId: Ydb.Type.PrimitiveTypeId.JSON_DOCUMENT};
    static DATE: IType = {typeId: Ydb.Type.PrimitiveTypeId.DATE};
    static DATETIME: IType = {typeId: Ydb.Type.PrimitiveTypeId.DATETIME};
    static TIMESTAMP: IType = {typeId: Ydb.Type.PrimitiveTypeId.TIMESTAMP};
    static INTERVAL: IType = {typeId: Ydb.Type.PrimitiveTypeId.INTERVAL};
    static TZ_DATE: IType = {typeId: Ydb.Type.PrimitiveTypeId.TZ_DATE};
    static TZ_DATETIME: IType = {typeId: Ydb.Type.PrimitiveTypeId.TZ_DATETIME};
    static TZ_TIMESTAMP: IType = {typeId: Ydb.Type.PrimitiveTypeId.TZ_TIMESTAMP};
    static DYNUMBER: IType = {typeId: Ydb.Type.PrimitiveTypeId.DYNUMBER};
    static VOID: IType = {voidType: NullValue.NULL_VALUE};
    static DEFAULT_DECIMAL: IType = Types.decimal(22, 9);

    static optional(type: IType): IType {
        return {optionalType: {item: type}};
    }

    static decimal(precision: number, scale: number): IType {
        return {decimalType: {precision, scale}};
    }

    static tuple(...types: IType[]): IType {
        return {tupleType: {elements: types}};
    }

    static list(type: IType): IType {
        return {listType: {item: type}};
    }

    static struct(fields: StructFields): IType {
        return {
            structType: {
                members: Object.entries(fields).map(([name, type]) => ({name, type})),
            },
        };
    }

    static dict(key: IType, payload: IType): IType {
        return {
            dictType: {
                key,
                payload,
            },
        };
    }

    static variant(type: IType): IType {
        if (type.structType) {
            return {
                variantType: {
                    structItems: type.structType,
                },
            };
        }
        if (type.tupleType) {
            return {
                variantType: {
                    tupleItems: type.tupleType,
                },
            };
        }

        throw new Error('Either tupleItems or structItems should be present in VariantType!');
    }
}

export class TypedValues {
    private static primitive(type: IType, value: primitive): ITypedValue {
        return {
            type: type,
            value: typeToValue(type, value),
        };
    }

    static VOID: ITypedValue = {
        type: Types.VOID,
        value: {
            nullFlagValue: NullValue.NULL_VALUE,
        },
    };

    static fromNative(type: Ydb.IType, value: any): ITypedValue {
        return {
            type,
            value: typeToValue(type, value),
        };
    }

    static bool(value: boolean): ITypedValue {
        return TypedValues.primitive(Types.BOOL, value);
    }

    static int8(value: number): ITypedValue {
        return TypedValues.primitive(Types.INT8, value);
    }

    static uint8(value: number): ITypedValue {
        return TypedValues.primitive(Types.UINT8, value);
    }

    static int16(value: number): ITypedValue {
        return TypedValues.primitive(Types.INT16, value);
    }

    static uint16(value: number): ITypedValue {
        return TypedValues.primitive(Types.UINT16, value);
    }

    static int32(value: number): ITypedValue {
        return TypedValues.primitive(Types.INT32, value);
    }

    static uint32(value: number): ITypedValue {
        return TypedValues.primitive(Types.UINT32, value);
    }

    static int64(value: number | Long): ITypedValue {
        return TypedValues.primitive(Types.INT64, value);
    }

    static uint64(value: number | Long): ITypedValue {
        return TypedValues.primitive(Types.UINT64, value);
    }

    static float(value: number): ITypedValue {
        return TypedValues.primitive(Types.FLOAT, value);
    }

    static double(value: number): ITypedValue {
        return TypedValues.primitive(Types.DOUBLE, value);
    }

    static bytes(value: Buffer): ITypedValue {
        return TypedValues.primitive(Types.BYTES, value);
    }

    static utf8(value: string): ITypedValue {
        return TypedValues.primitive(Types.UTF8, value);
    }

    static text(value: string): ITypedValue {
        return TypedValues.primitive(Types.TEXT, value);
    }

    static yson(value: Buffer): ITypedValue {
        return TypedValues.primitive(Types.YSON, value);
    }

    static json(value: string): ITypedValue {
        return TypedValues.primitive(Types.JSON, value);
    }

    static uuid(value: string): ITypedValue {
        return TypedValues.primitive(Types.UUID, value);
    }

    static jsonDocument(value: string): ITypedValue {
        return TypedValues.primitive(Types.JSON_DOCUMENT, value);
    }

    static date(value: Date): ITypedValue {
        return TypedValues.primitive(Types.DATE, value);
    }

    static datetime(value: Date): ITypedValue {
        return TypedValues.primitive(Types.DATETIME, value);
    }

    static timestamp(value: Date): ITypedValue {
        return TypedValues.primitive(Types.TIMESTAMP, value);
    }

    static interval(value: number): ITypedValue {
        return TypedValues.primitive(Types.INTERVAL, value);
    }

    static tzDate(value: Date): ITypedValue {
        return TypedValues.primitive(Types.TZ_DATE, value);
    }

    static tzDatetime(value: Date): ITypedValue {
        return TypedValues.primitive(Types.TZ_DATETIME, value);
    }

    static tzTimestamp(value: Date): ITypedValue {
        return TypedValues.primitive(Types.TZ_TIMESTAMP, value);
    }

    static dynumber(value: string): ITypedValue {
        return TypedValues.primitive(Types.DYNUMBER, value);
    }

    static optional(value: Ydb.ITypedValue): Ydb.ITypedValue {
        return {
            type: {
                optionalType: {
                    item: value.type,
                },
            },
            value: value.value,
        };
    }

    static optionalNull(type: Ydb.IType): Ydb.ITypedValue {
        return {
            type: {
                optionalType: {
                    item: type,
                },
            },
            value: {
                nullFlagValue: NullValue.NULL_VALUE,
            },
        };
    }

    static decimal(value: string, precision: number = 22, scale: number = 9): ITypedValue {
        const type = Types.decimal(precision, scale);
        return {
            type,
            value: typeToValue(type, value),
        };
    }

    static tuple(...values: Ydb.ITypedValue[]): Ydb.ITypedValue {
        return {
            type: {
                tupleType: {
                    elements: values.map((v) => v.type).filter((t) => t) as Ydb.IType[],
                },
            },
            value: {
                items: values.map((v) => v.value).filter((v) => v) as Ydb.IValue[],
            },
        };
    }

    static list(type: Ydb.IType, values: any[]): Ydb.ITypedValue {
        return {
            type: {
                listType: {
                    item: type,
                },
            },
            value: {
                items: values.map(value => typeToValue(type, value)),
            },
        };
    }

    static struct(fields: StructFields, struct: any): Ydb.ITypedValue {
        const type = Types.struct(fields);
        return {
            type,
            value: typeToValue(type, struct),
        };
    }

    static dict(key: Ydb.IType, payload: Ydb.IType, dict: Record<any, any>): Ydb.ITypedValue {
        const type = Types.dict(key, payload);
        return {
            type,
            value: typeToValue(type, dict),
        };
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
    'bytesValue': (input) => input,
    'textValue': (input) => input,
    'nullFlagValue': () => null,
};

function convertYdbValueToNative(type: IType, value: IValue): any {
    if (type.typeId) {
        if (type.typeId === PrimitiveTypeId.UUID) {
            return uuidToNative(value);
        }
        const label = primitiveTypeToValue[type.typeId];
        if (!label) {
            throw new Error(`Unknown PrimitiveTypeId: ${type.typeId}`);
        }
        const input = (value as any)[label];
        return objectFromValue(type, valueToNativeConverters[label](input));
    } else if (type.decimalType) {
        const high128 = value.high_128 as number | Long;
        const low128 = value.low_128 as number | Long;
        const scale = type.decimalType.scale as number;
        return toDecimalString(high128, low128, scale);
    } else if (type.optionalType) {
        const innerType = type.optionalType.item as IType;
        if (value.nullFlagValue === NullValue.NULL_VALUE) {
            return null;
        }
        return convertYdbValueToNative(innerType, value);
    } else if (type.listType) {
        const innerType = type.listType.item as IType;
        return _.map(value.items, (item) => convertYdbValueToNative(innerType, item));
    } else if (type.tupleType) {
        const types = type.tupleType.elements as IType[];
        const values = value.items as IValue[];
        return values.map((value, index) => convertYdbValueToNative(types[index], value));
    } else if (type.structType) {
        const members = type.structType.members as Ydb.IStructMember[];
        const items = value.items as Ydb.IValue[];
        const struct = {} as any;
        items.forEach((item, index) => {
            const member = members[index];
            const memberName = member.name as string;
            const memberType = member.type as IType;
            struct[memberName] = convertYdbValueToNative(memberType, item);
        });
        return struct;
    } else if (type.dictType) {
        const keyType = type.dictType.key as IType;
        const payloadType = type.dictType.payload as IType;

        const dict = {} as any;
        value.pairs?.forEach((pair) => {
            const nativeKey = convertYdbValueToNative(keyType, pair.key as IValue);
            dict[nativeKey] = convertYdbValueToNative(payloadType, pair.payload as IValue);
        });
        return dict;
    } else if (type.variantType) {
        if (type.variantType.tupleItems) {
            const elements = type.variantType.tupleItems.elements as IType[];
            const item = value.nestedValue as IValue;
            const variantIndex = value.variantIndex as number;

            return elements.map((element, index) => {
                if (index === variantIndex) {
                    return convertYdbValueToNative(element, item);
                }
                return undefined;
            });
        } else if (type.variantType.structItems) {
            const members = type.variantType.structItems.members as IStructMember[];
            const item = value.nestedValue as IValue;
            const variantIndex = value.variantIndex as number;
            const variantType = members[variantIndex].type as IType;
            const variantName = members[variantIndex].name as string;

            return {
                [variantName]: convertYdbValueToNative(variantType, item),
            };
        } else {
            throw new Error('Either tupleItems or structItems should be present in VariantType!');
        }
        // } else if (type.taggedType) {
        //     // TODO: Enable in future versions of YDB
        //     const memberType = type.taggedType.type as IType
        //     const memberTag = type.taggedType.tag as string
        //     const res = convertYdbValueToNative(memberType, value)
        //     res.__proto__.tag = memberTag
    } else if (type.voidType === NullValue.NULL_VALUE) {
        return null;
    } else {
        throw new Error(`Unknown type ${JSON.stringify(type)}`);
    }
}

function objectFromValue(type: IType, value: unknown) {
    const {typeId} = type;
    switch (typeId) {
        case PrimitiveTypeId.YSON:
        case PrimitiveTypeId.STRING:
            return value as Buffer;
        case PrimitiveTypeId.DATE:
            return new Date((value as number) * 3600 * 1000 * 24);
        case PrimitiveTypeId.DATETIME:
            return new Date((value as number) * 1000);
        case PrimitiveTypeId.TIMESTAMP:
            return new Date((value as number) / 1000);
        case PrimitiveTypeId.TZ_DATE:
        case PrimitiveTypeId.TZ_DATETIME:
        case PrimitiveTypeId.TZ_TIMESTAMP: {
            const [datetime] = (value as string).split(',');
            return new Date(datetime + 'Z');
        }
        default:
            return value;
    }
}

function preparePrimitiveValue(type: IType, value: any) {
    if (type === Types.BYTES) {
        return value instanceof Buffer ? value : Buffer.from(value);
    }
    const typeId = type.typeId;
    switch (typeId) {
        case PrimitiveTypeId.DATE:
            return Number(value) / 3600 / 1000 / 24;
        case PrimitiveTypeId.DATETIME:
            return Number(value) / 1000;
        case PrimitiveTypeId.TIMESTAMP:
            return Number(value) * 1000;
        case PrimitiveTypeId.TZ_DATE:
            return DateTime.fromJSDate(value as Date).toISODate() + ',GMT';
        case PrimitiveTypeId.TZ_DATETIME:
            return DateTime.fromJSDate(value as Date, {zone: 'UTC'}).toFormat(`yyyy-MM-dd'T'HH:mm:ss',GMT'`);
        case PrimitiveTypeId.TZ_TIMESTAMP:
            return (value as Date).toISOString().replace('Z', '') + ',GMT';
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
        if (type.typeId === PrimitiveTypeId.UUID) {
            return uuidToValue(value);
        }
        const valueLabel = primitiveTypeToValue[type.typeId];
        if (valueLabel) {
            return {[valueLabel]: preparePrimitiveValue(type, value)};
        } else {
            throw new Error(`Unknown PrimitiveTypeId: ${type.typeId}`);
        }
    } else if (type.decimalType) {
        const decimalValue = value as string;
        const scale = type.decimalType.scale as number;
        return fromDecimalString(decimalValue, scale);
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
            items: _.map(members, (member) => {
                const memberType = member.type as IType;
                const memberValue = value[member.name as string];
                return typeToValue(memberType, memberValue);
            }),
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
        if (type.variantType.tupleItems) {
            const elements = type.variantType.tupleItems.elements as IType[];
            const variantIndex = (value as Array<any>).findIndex((v) => v !== null);
            return {
                nestedValue: typeToValue(elements[variantIndex], value[variantIndex]),
                variantIndex,
            };
        } else if (type.variantType.structItems) {
            const members = type.variantType.structItems.members as IStructMember[];
            const variantKey = Object.keys(value)[0];
            const variantIndex = members.findIndex((a) => variantKey === a.name);

            if (variantKey === undefined)
                throw new Error("Variant type doesn't have not null fields");

            return {
                nestedValue: typeToValue(members[variantIndex].type, value[variantKey]),
                variantIndex,
            };
        }
        throw new Error('Either tupleItems or structItems should be present in VariantType!');
    } else if (type.voidType === NullValue.NULL_VALUE) {
        return {
            nullFlagValue: NullValue.NULL_VALUE,
        };
    } else {
        throw new Error(`Unknown type ${JSON.stringify(type)}`);
    }
}

export type StringFunction = (name?: string) => string;
export interface NamesConversion {
    ydbToJs: StringFunction;
    jsToYdb: StringFunction;
}

export interface TypedDataOptions {
    namesConversion?: NamesConversion;
}

export function getNameConverter(options: TypedDataOptions, direction: keyof NamesConversion): StringFunction {
    return (options.namesConversion || identityConversion)[direction];
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
                    acc[converter(column.name)] = convertYdbValueToNative(column.type, value);
                }
                return acc;
            }, {});
            return new this(obj);
        })
    }

    static asTypedCollection(collection: TypedData[]): ITypedValue {
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
