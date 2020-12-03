import _ from 'lodash';
import Long from 'long';
import {google, Ydb} from "../proto/bundle";
import 'reflect-metadata';

const Type = Ydb.Type;
type IType = Ydb.IType;
type IStructMember = Ydb.IStructMember;
type IValue = Ydb.IValue;
type IColumn = Ydb.IColumn;
type ITypedValue = Ydb.ITypedValue;
type IResultSet = Ydb.IResultSet;


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

    [Type.PrimitiveTypeId.DATE]: 'uint32Value',
    [Type.PrimitiveTypeId.DATETIME]: 'uint32Value',
    [Type.PrimitiveTypeId.TIMESTAMP]: 'uint64Value',
    [Type.PrimitiveTypeId.INTERVAL]: 'uint64Value',
    [Type.PrimitiveTypeId.TZ_DATE]: 'uint32Value',
    [Type.PrimitiveTypeId.TZ_DATETIME]: 'uint32Value',
    [Type.PrimitiveTypeId.TZ_TIMESTAMP]: 'uint64Value',
};

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
function convertPrimitiveValueToNative(value: IValue) {
    let label, input;
    for ([label, input] of Object.entries(value)) {
        if (label !== 'items' && label !== 'pairs') {
            break;
        }
    }
    if (!label) {
        throw new Error(`Expected a primitive value, got ${value} instead!`);
    }
    return valueToNativeConverters[label](input);
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
            return {[valueLabel]: value};
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
                nullFlagValue: google.protobuf.NullValue.NULL_VALUE
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

export class TypedData {
    [property: string]: any;

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
        return {
            structType: {
                members: _.map(this.typedProperties, (propertyKey) => ({
                    name: _.snakeCase(propertyKey),
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
        return _.map(rows, (row) => {
            const obj = _.reduce(row.items, (acc: Record<string, any>, value, index) => {
                const column = columns[index] as IColumn;
                if (column.name) {
                    acc[_.camelCase(column.name)] = convertPrimitiveValueToNative(value);
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
