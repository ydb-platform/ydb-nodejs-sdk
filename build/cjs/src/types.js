"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypedData = exports.identityConversion = exports.snakeToCamelCaseConversion = exports.withTypeOptions = exports.getNameConverter = exports.convertYdbValueToNative = exports.TypedValues = exports.Types = exports.primitiveTypeToValue = exports.declareType = exports.typeMetadataKey = void 0;
const lodash_1 = __importDefault(require("lodash"));
const long_1 = __importDefault(require("long"));
const ydb_sdk_proto_1 = require("ydb-sdk-proto");
require("reflect-metadata");
const luxon_1 = require("luxon");
const uuid_1 = require("./uuid");
const decimal_1 = require("./decimal");
var Type = ydb_sdk_proto_1.Ydb.Type;
var PrimitiveTypeId = ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId;
var NullValue = ydb_sdk_proto_1.google.protobuf.NullValue;
exports.typeMetadataKey = Symbol('type');
function declareType(type) {
    return Reflect.metadata(exports.typeMetadataKey, type);
}
exports.declareType = declareType;
exports.primitiveTypeToValue = {
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
class Types {
    static optional(type) {
        return { optionalType: { item: type } };
    }
    /**
     * A real number with the specified precision, up to 35 decimal digits
     * @param precision Total number of decimal places (up to 35, inclusive).
     * @param scale Number of places after the decimal point (out of the total number, meaning it can't be larger than the previous argument)
     */
    static decimal(precision, scale) {
        return { decimalType: { precision, scale } };
    }
    static tuple(...types) {
        return { tupleType: { elements: types } };
    }
    static list(type) {
        return { listType: { item: type } };
    }
    static struct(fields) {
        return {
            structType: {
                members: Object.entries(fields).map(([name, type]) => ({ name, type })),
            },
        };
    }
    static dict(key, payload) {
        return {
            dictType: {
                key,
                payload,
            },
        };
    }
    static variant(type) {
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
exports.Types = Types;
Types.BOOL = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.BOOL };
Types.INT8 = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.INT8 };
Types.UINT8 = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT8 };
Types.INT16 = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.INT16 };
Types.UINT16 = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT16 };
Types.INT32 = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.INT32 };
Types.UINT32 = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT32 };
Types.INT64 = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.INT64 };
Types.UINT64 = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT64 };
Types.FLOAT = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.FLOAT };
Types.DOUBLE = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.DOUBLE };
Types.BYTES = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.STRING };
Types.UTF8 = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UTF8 };
Types.TEXT = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UTF8 };
Types.YSON = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.YSON };
Types.JSON = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.JSON };
Types.UUID = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UUID };
Types.JSON_DOCUMENT = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.JSON_DOCUMENT };
Types.DATE = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.DATE };
Types.DATETIME = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.DATETIME };
Types.TIMESTAMP = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.TIMESTAMP };
Types.INTERVAL = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.INTERVAL };
Types.TZ_DATE = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.TZ_DATE };
Types.TZ_DATETIME = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.TZ_DATETIME };
Types.TZ_TIMESTAMP = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.TZ_TIMESTAMP };
Types.DYNUMBER = { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.DYNUMBER };
Types.VOID = { voidType: NullValue.NULL_VALUE };
Types.DEFAULT_DECIMAL = Types.decimal(22, 9);
class TypedValues {
    static primitive(type, value) {
        return {
            type: type,
            value: typeToValue(type, value),
        };
    }
    static fromNative(type, value) {
        return {
            type,
            value: typeToValue(type, value),
        };
    }
    static bool(value) {
        return TypedValues.primitive(Types.BOOL, value);
    }
    static int8(value) {
        return TypedValues.primitive(Types.INT8, value);
    }
    static uint8(value) {
        return TypedValues.primitive(Types.UINT8, value);
    }
    static int16(value) {
        return TypedValues.primitive(Types.INT16, value);
    }
    static uint16(value) {
        return TypedValues.primitive(Types.UINT16, value);
    }
    static int32(value) {
        return TypedValues.primitive(Types.INT32, value);
    }
    static uint32(value) {
        return TypedValues.primitive(Types.UINT32, value);
    }
    static int64(value) {
        return TypedValues.primitive(Types.INT64, value);
    }
    static uint64(value) {
        return TypedValues.primitive(Types.UINT64, value);
    }
    static float(value) {
        return TypedValues.primitive(Types.FLOAT, value);
    }
    static double(value) {
        return TypedValues.primitive(Types.DOUBLE, value);
    }
    static bytes(value) {
        return TypedValues.primitive(Types.BYTES, value);
    }
    static utf8(value) {
        return TypedValues.primitive(Types.UTF8, value);
    }
    static text(value) {
        return TypedValues.primitive(Types.TEXT, value);
    }
    static yson(value) {
        return TypedValues.primitive(Types.YSON, value);
    }
    static json(value) {
        return TypedValues.primitive(Types.JSON, value);
    }
    static uuid(value) {
        return TypedValues.primitive(Types.UUID, value);
    }
    static jsonDocument(value) {
        return TypedValues.primitive(Types.JSON_DOCUMENT, value);
    }
    static date(value) {
        return TypedValues.primitive(Types.DATE, value);
    }
    static datetime(value) {
        return TypedValues.primitive(Types.DATETIME, value);
    }
    static timestamp(value) {
        return TypedValues.primitive(Types.TIMESTAMP, value);
    }
    static interval(value) {
        return TypedValues.primitive(Types.INTERVAL, value);
    }
    static tzDate(value) {
        return TypedValues.primitive(Types.TZ_DATE, value);
    }
    static tzDatetime(value) {
        return TypedValues.primitive(Types.TZ_DATETIME, value);
    }
    static tzTimestamp(value) {
        return TypedValues.primitive(Types.TZ_TIMESTAMP, value);
    }
    static dynumber(value) {
        return TypedValues.primitive(Types.DYNUMBER, value);
    }
    static optional(value) {
        return {
            type: {
                optionalType: {
                    item: value.type,
                },
            },
            value: value.value,
        };
    }
    static optionalNull(type) {
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
    static decimal(value, precision = 22, scale = 9) {
        const type = Types.decimal(precision, scale);
        return {
            type,
            value: typeToValue(type, value),
        };
    }
    static tuple(...values) {
        return {
            type: {
                tupleType: {
                    elements: values.map((v) => v.type).filter((t) => t),
                },
            },
            value: {
                items: values.map((v) => v.value).filter((v) => v),
            },
        };
    }
    static list(type, values) {
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
    static struct(fields, struct) {
        const type = Types.struct(fields);
        return {
            type,
            value: typeToValue(type, struct),
        };
    }
    static dict(key, payload, dict) {
        const type = Types.dict(key, payload);
        return {
            type,
            value: typeToValue(type, dict),
        };
    }
}
exports.TypedValues = TypedValues;
TypedValues.VOID = {
    type: Types.VOID,
    value: {
        nullFlagValue: NullValue.NULL_VALUE,
    },
};
const parseLong = (input) => {
    let res = long_1.default.fromValue(input);
    return res.high ? res : res.low;
};
const valueToNativeConverters = {
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
function convertYdbValueToNative(type, value) {
    var _a;
    if (type.typeId) {
        if (type.typeId === PrimitiveTypeId.UUID) {
            return (0, uuid_1.uuidToNative)(value);
        }
        const label = exports.primitiveTypeToValue[type.typeId];
        if (!label) {
            throw new Error(`Unknown PrimitiveTypeId: ${type.typeId}`);
        }
        const input = value[label];
        return objectFromValue(type, valueToNativeConverters[label](input));
    }
    else if (type.decimalType) {
        const high128 = value.high_128;
        const low128 = value.low_128;
        const scale = type.decimalType.scale;
        return (0, decimal_1.toDecimalString)(high128, low128, scale);
    }
    else if (type.optionalType) {
        const innerType = type.optionalType.item;
        if (value.nullFlagValue === NullValue.NULL_VALUE) {
            return null;
        }
        return convertYdbValueToNative(innerType, value);
    }
    else if (type.listType) {
        const innerType = type.listType.item;
        return lodash_1.default.map(value.items, (item) => convertYdbValueToNative(innerType, item));
    }
    else if (type.tupleType) {
        const types = type.tupleType.elements;
        const values = value.items;
        return values.map((value, index) => convertYdbValueToNative(types[index], value));
    }
    else if (type.structType) {
        const members = type.structType.members;
        const items = value.items;
        const struct = {};
        items.forEach((item, index) => {
            const member = members[index];
            const memberName = member.name;
            const memberType = member.type;
            struct[memberName] = convertYdbValueToNative(memberType, item);
        });
        return struct;
    }
    else if (type.dictType) {
        const keyType = type.dictType.key;
        const payloadType = type.dictType.payload;
        const dict = {};
        (_a = value.pairs) === null || _a === void 0 ? void 0 : _a.forEach((pair) => {
            const nativeKey = convertYdbValueToNative(keyType, pair.key);
            dict[nativeKey] = convertYdbValueToNative(payloadType, pair.payload);
        });
        return dict;
    }
    else if (type.variantType) {
        if (type.variantType.tupleItems) {
            const elements = type.variantType.tupleItems.elements;
            const item = value.nestedValue;
            const variantIndex = value.variantIndex;
            return elements.map((element, index) => {
                if (index === variantIndex) {
                    return convertYdbValueToNative(element, item);
                }
                return undefined;
            });
        }
        else if (type.variantType.structItems) {
            const members = type.variantType.structItems.members;
            const item = value.nestedValue;
            const variantIndex = value.variantIndex;
            const variantType = members[variantIndex].type;
            const variantName = members[variantIndex].name;
            return {
                [variantName]: convertYdbValueToNative(variantType, item),
            };
        }
        else {
            throw new Error('Either tupleItems or structItems should be present in VariantType!');
        }
        // } else if (type.taggedType) {
        //     // TODO: Enable in future versions of YDB
        //     const memberType = type.taggedType.type as IType
        //     const memberTag = type.taggedType.tag as string
        //     const res = convertYdbValueToNative(memberType, value)
        //     res.__proto__.tag = memberTag
    }
    else if (type.voidType === NullValue.NULL_VALUE) {
        return null;
    }
    else {
        throw new Error(`Unknown type ${JSON.stringify(type)}`);
    }
}
exports.convertYdbValueToNative = convertYdbValueToNative;
function objectFromValue(type, value) {
    const { typeId } = type;
    switch (typeId) {
        case PrimitiveTypeId.YSON:
            return value.toString('utf8');
        case PrimitiveTypeId.STRING:
            return value;
        case PrimitiveTypeId.DATE:
            return new Date(value * 3600 * 1000 * 24);
        case PrimitiveTypeId.DATETIME:
            return new Date(value * 1000);
        case PrimitiveTypeId.TIMESTAMP:
            return new Date(value / 1000);
        case PrimitiveTypeId.TZ_DATE:
        case PrimitiveTypeId.TZ_DATETIME:
        case PrimitiveTypeId.TZ_TIMESTAMP: {
            const [datetime] = value.split(',');
            return new Date(datetime + 'Z');
        }
        default:
            return value;
    }
}
function preparePrimitiveValue(type, value) {
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
            return luxon_1.DateTime.fromJSDate(value).toISODate() + ',GMT';
        case PrimitiveTypeId.TZ_DATETIME:
            return luxon_1.DateTime.fromJSDate(value, { zone: 'UTC' }).toFormat(`yyyy-MM-dd'T'HH:mm:ss',GMT'`);
        case PrimitiveTypeId.TZ_TIMESTAMP:
            return value.toISOString().replace('Z', '') + ',GMT';
        default:
            return value;
    }
}
function typeToValue(type, value) {
    if (!type) {
        if (value) {
            throw new Error(`Got no type while the value is ${value}`);
        }
        else {
            throw new Error('Both type and value are empty');
        }
    }
    else if (type.typeId) {
        if (type.typeId === PrimitiveTypeId.UUID) {
            return (0, uuid_1.uuidToValue)(value);
        }
        const valueLabel = exports.primitiveTypeToValue[type.typeId];
        if (valueLabel) {
            return { [valueLabel]: preparePrimitiveValue(type, value) };
        }
        else {
            throw new Error(`Unknown PrimitiveTypeId: ${type.typeId}`);
        }
    }
    else if (type.decimalType) {
        const decimalValue = value;
        const scale = type.decimalType.scale;
        return (0, decimal_1.fromDecimalString)(decimalValue, scale);
    }
    else if (type.optionalType) {
        const innerType = type.optionalType.item;
        if (value !== undefined && value !== null) {
            return typeToValue(innerType, value);
        }
        else {
            return {
                nullFlagValue: NullValue.NULL_VALUE
            };
        }
    }
    else if (type.listType) {
        const listType = type.listType;
        return {
            items: lodash_1.default.map(value, (item) => typeToValue(listType.item, item))
        };
    }
    else if (type.tupleType) {
        const elements = type.tupleType.elements;
        return {
            items: lodash_1.default.map(value, (item, index) => typeToValue(elements[index], item))
        };
    }
    else if (type.structType) {
        const members = type.structType.members;
        return {
            items: lodash_1.default.map(members, (member) => {
                const memberType = member.type;
                const memberValue = value[member.name];
                return typeToValue(memberType, memberValue);
            }),
        };
    }
    else if (type.dictType) {
        const keyType = type.dictType.key;
        const payloadType = type.dictType.payload;
        return {
            pairs: lodash_1.default.map(lodash_1.default.entries(value), ([key, value]) => ({
                key: typeToValue(keyType, key),
                payload: typeToValue(payloadType, value)
            }))
        };
    }
    else if (type.variantType) {
        if (type.variantType.tupleItems) {
            const elements = type.variantType.tupleItems.elements;
            const variantIndex = value.findIndex((v) => v !== undefined);
            return {
                nestedValue: typeToValue(elements[variantIndex], value[variantIndex]),
                variantIndex,
            };
        }
        else if (type.variantType.structItems) {
            const members = type.variantType.structItems.members;
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
    }
    else if (type.voidType === NullValue.NULL_VALUE) {
        return {
            nullFlagValue: NullValue.NULL_VALUE,
        };
    }
    else {
        throw new Error(`Unknown type ${JSON.stringify(type)}`);
    }
}
function getNameConverter(options, direction) {
    return (options.namesConversion || exports.identityConversion)[direction];
}
exports.getNameConverter = getNameConverter;
function withTypeOptions(options) {
    return function (constructor) {
        return lodash_1.default.merge(constructor, { __options: options });
    };
}
exports.withTypeOptions = withTypeOptions;
exports.snakeToCamelCaseConversion = {
    jsToYdb: lodash_1.default.snakeCase,
    ydbToJs: lodash_1.default.camelCase,
};
exports.identityConversion = {
    jsToYdb: lodash_1.default.identity,
    ydbToJs: lodash_1.default.identity,
};
class TypedData {
    constructor(data) {
        lodash_1.default.assign(this, data);
    }
    getType(propertyKey) {
        const typeMeta = Reflect.getMetadata(exports.typeMetadataKey, this, propertyKey);
        if (!typeMeta) {
            throw new Error(`Property ${propertyKey} should be decorated with @declareType!`);
        }
        return typeMeta;
    }
    getValue(propertyKey) {
        const type = this.getType(propertyKey);
        return typeToValue(type, this[propertyKey]);
    }
    getTypedValue(propertyKey) {
        return {
            type: this.getType(propertyKey),
            value: this.getValue(propertyKey)
        };
    }
    get typedProperties() {
        return lodash_1.default.filter(Reflect.ownKeys(this), (key) => (typeof key === 'string' && Reflect.hasMetadata(exports.typeMetadataKey, this, key)));
    }
    getRowType() {
        const cls = this.constructor;
        const converter = getNameConverter(cls.__options, 'jsToYdb');
        return {
            structType: {
                members: lodash_1.default.map(this.typedProperties, (propertyKey) => ({
                    name: converter(propertyKey),
                    type: this.getType(propertyKey)
                }))
            }
        };
    }
    getRowValue() {
        return {
            items: lodash_1.default.map(this.typedProperties, (propertyKey) => {
                return this.getValue(propertyKey);
            })
        };
    }
    static createNativeObjects(resultSet) {
        const { rows, columns } = resultSet;
        if (!columns) {
            return [];
        }
        const converter = getNameConverter(this.__options, 'ydbToJs');
        return lodash_1.default.map(rows, (row) => {
            const obj = lodash_1.default.reduce(row.items, (acc, value, index) => {
                const column = columns[index];
                if (column.name && column.type) {
                    acc[converter(column.name)] = convertYdbValueToNative(column.type, value);
                }
                return acc;
            }, {});
            return new this(obj);
        });
    }
    static asTypedCollection(collection) {
        return {
            type: {
                listType: {
                    item: collection[0].getRowType()
                }
            },
            value: {
                items: collection.map((item) => item.getRowValue())
            }
        };
    }
}
exports.TypedData = TypedData;
TypedData.__options = {};
