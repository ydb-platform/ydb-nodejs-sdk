"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypedData = exports.identityConversion = exports.snakeToCamelCaseConversion = exports.withTypeOptions = exports.getNameConverter = exports.convertYdbValueToNative = exports.TypedValues = exports.Types = exports.primitiveTypeToValue = exports.declareType = exports.typeMetadataKey = void 0;
var lodash_1 = require("lodash");
var long_1 = require("long");
var ydb_sdk_proto_1 = require("ydb-sdk-proto");
require("reflect-metadata");
var luxon_1 = require("luxon");
var uuid_1 = require("./uuid");
var decimal_1 = require("./utils/decimal");
var Type = ydb_sdk_proto_1.Ydb.Type;
var PrimitiveTypeId = ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId;
var NullValue = ydb_sdk_proto_1.google.protobuf.NullValue;
exports.typeMetadataKey = Symbol('type');
function declareType(type) {
    return Reflect.metadata(exports.typeMetadataKey, type);
}
exports.declareType = declareType;
exports.primitiveTypeToValue = (_a = {},
    _a[Type.PrimitiveTypeId.BOOL] = 'boolValue',
    _a[Type.PrimitiveTypeId.INT8] = 'int32Value',
    _a[Type.PrimitiveTypeId.UINT8] = 'uint32Value',
    _a[Type.PrimitiveTypeId.INT16] = 'int32Value',
    _a[Type.PrimitiveTypeId.UINT16] = 'uint32Value',
    _a[Type.PrimitiveTypeId.INT32] = 'int32Value',
    _a[Type.PrimitiveTypeId.UINT32] = 'uint32Value',
    _a[Type.PrimitiveTypeId.INT64] = 'int64Value',
    _a[Type.PrimitiveTypeId.UINT64] = 'uint64Value',
    _a[Type.PrimitiveTypeId.FLOAT] = 'floatValue',
    _a[Type.PrimitiveTypeId.DOUBLE] = 'doubleValue',
    _a[Type.PrimitiveTypeId.STRING] = 'bytesValue',
    _a[Type.PrimitiveTypeId.UTF8] = 'textValue',
    _a[Type.PrimitiveTypeId.YSON] = 'bytesValue',
    _a[Type.PrimitiveTypeId.JSON] = 'textValue',
    _a[Type.PrimitiveTypeId.JSON_DOCUMENT] = 'textValue',
    _a[Type.PrimitiveTypeId.DYNUMBER] = 'textValue',
    _a[Type.PrimitiveTypeId.DATE] = 'uint32Value',
    _a[Type.PrimitiveTypeId.DATETIME] = 'uint32Value',
    _a[Type.PrimitiveTypeId.TIMESTAMP] = 'uint64Value',
    _a[Type.PrimitiveTypeId.INTERVAL] = 'int64Value',
    _a[Type.PrimitiveTypeId.TZ_DATE] = 'textValue',
    _a[Type.PrimitiveTypeId.TZ_DATETIME] = 'textValue',
    _a[Type.PrimitiveTypeId.TZ_TIMESTAMP] = 'textValue',
    _a);
var Types = /** @class */ (function () {
    function Types() {
    }
    Types.optional = function (type) {
        return { optionalType: { item: type } };
    };
    /**
     * A real number with the specified precision, up to 35 decimal digits
     * @param precision Total number of decimal places (up to 35, inclusive).
     * @param scale Number of places after the decimal point (out of the total number, meaning it can't be larger than the previous argument)
     */
    Types.decimal = function (precision, scale) {
        return { decimalType: { precision: precision, scale: scale } };
    };
    Types.tuple = function () {
        var types = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            types[_i] = arguments[_i];
        }
        return { tupleType: { elements: types } };
    };
    Types.list = function (type) {
        return { listType: { item: type } };
    };
    Types.struct = function (fields) {
        return {
            structType: {
                members: Object.entries(fields).map(function (_a) {
                    var name = _a[0], type = _a[1];
                    return ({ name: name, type: type });
                }),
            },
        };
    };
    Types.dict = function (key, payload) {
        return {
            dictType: {
                key: key,
                payload: payload,
            },
        };
    };
    Types.variant = function (type) {
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
    };
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
    return Types;
}());
exports.Types = Types;
var TypedValues = /** @class */ (function () {
    function TypedValues() {
    }
    TypedValues.primitive = function (type, value) {
        return {
            type: type,
            value: typeToValue(type, value),
        };
    };
    TypedValues.fromNative = function (type, value) {
        return {
            type: type,
            value: typeToValue(type, value),
        };
    };
    TypedValues.bool = function (value) {
        return TypedValues.primitive(Types.BOOL, value);
    };
    TypedValues.int8 = function (value) {
        return TypedValues.primitive(Types.INT8, value);
    };
    TypedValues.uint8 = function (value) {
        return TypedValues.primitive(Types.UINT8, value);
    };
    TypedValues.int16 = function (value) {
        return TypedValues.primitive(Types.INT16, value);
    };
    TypedValues.uint16 = function (value) {
        return TypedValues.primitive(Types.UINT16, value);
    };
    TypedValues.int32 = function (value) {
        return TypedValues.primitive(Types.INT32, value);
    };
    TypedValues.uint32 = function (value) {
        return TypedValues.primitive(Types.UINT32, value);
    };
    TypedValues.int64 = function (value) {
        return TypedValues.primitive(Types.INT64, value);
    };
    TypedValues.uint64 = function (value) {
        return TypedValues.primitive(Types.UINT64, value);
    };
    TypedValues.float = function (value) {
        return TypedValues.primitive(Types.FLOAT, value);
    };
    TypedValues.double = function (value) {
        return TypedValues.primitive(Types.DOUBLE, value);
    };
    TypedValues.bytes = function (value) {
        return TypedValues.primitive(Types.BYTES, value);
    };
    TypedValues.utf8 = function (value) {
        return TypedValues.primitive(Types.UTF8, value);
    };
    TypedValues.text = function (value) {
        return TypedValues.primitive(Types.TEXT, value);
    };
    TypedValues.yson = function (value) {
        return TypedValues.primitive(Types.YSON, value);
    };
    TypedValues.json = function (value) {
        return TypedValues.primitive(Types.JSON, value);
    };
    TypedValues.uuid = function (value) {
        return TypedValues.primitive(Types.UUID, value);
    };
    TypedValues.jsonDocument = function (value) {
        return TypedValues.primitive(Types.JSON_DOCUMENT, value);
    };
    TypedValues.date = function (value) {
        return TypedValues.primitive(Types.DATE, value);
    };
    TypedValues.datetime = function (value) {
        return TypedValues.primitive(Types.DATETIME, value);
    };
    TypedValues.timestamp = function (value) {
        return TypedValues.primitive(Types.TIMESTAMP, value);
    };
    TypedValues.interval = function (value) {
        return TypedValues.primitive(Types.INTERVAL, value);
    };
    TypedValues.tzDate = function (value) {
        return TypedValues.primitive(Types.TZ_DATE, value);
    };
    TypedValues.tzDatetime = function (value) {
        return TypedValues.primitive(Types.TZ_DATETIME, value);
    };
    TypedValues.tzTimestamp = function (value) {
        return TypedValues.primitive(Types.TZ_TIMESTAMP, value);
    };
    TypedValues.dynumber = function (value) {
        return TypedValues.primitive(Types.DYNUMBER, value);
    };
    TypedValues.optional = function (value) {
        return {
            type: {
                optionalType: {
                    item: value.type,
                },
            },
            value: value.value,
        };
    };
    TypedValues.optionalNull = function (type) {
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
    };
    TypedValues.decimal = function (value, precision, scale) {
        if (precision === void 0) { precision = 22; }
        if (scale === void 0) { scale = 9; }
        var type = Types.decimal(precision, scale);
        return {
            type: type,
            value: typeToValue(type, value),
        };
    };
    TypedValues.tuple = function () {
        var values = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            values[_i] = arguments[_i];
        }
        return {
            type: {
                tupleType: {
                    elements: values.map(function (v) { return v.type; }).filter(function (t) { return t; }),
                },
            },
            value: {
                items: values.map(function (v) { return v.value; }).filter(function (v) { return v; }),
            },
        };
    };
    TypedValues.list = function (type, values) {
        return {
            type: {
                listType: {
                    item: type,
                },
            },
            value: {
                items: values.map(function (value) { return typeToValue(type, value); }),
            },
        };
    };
    TypedValues.struct = function (fields, struct) {
        var type = Types.struct(fields);
        return {
            type: type,
            value: typeToValue(type, struct),
        };
    };
    TypedValues.dict = function (key, payload, dict) {
        var type = Types.dict(key, payload);
        return {
            type: type,
            value: typeToValue(type, dict),
        };
    };
    TypedValues.VOID = {
        type: Types.VOID,
        value: {
            nullFlagValue: NullValue.NULL_VALUE,
        },
    };
    return TypedValues;
}());
exports.TypedValues = TypedValues;
var parseLong = function (input) {
    var res = long_1.default.fromValue(input);
    return res.high ? res : res.low;
};
var valueToNativeConverters = {
    'boolValue': function (input) { return Boolean(input); },
    'int32Value': function (input) { return Number(input); },
    'uint32Value': function (input) { return Number(input); },
    'int64Value': function (input) { return parseLong(input); },
    'uint64Value': function (input) { return parseLong(input); },
    'floatValue': function (input) { return Number(input); },
    'doubleValue': function (input) { return Number(input); },
    'bytesValue': function (input) { return input; },
    'textValue': function (input) { return input; },
    'nullFlagValue': function () { return null; },
};
function convertYdbValueToNative(type, value) {
    var _a;
    var _b;
    // TODO: Performance may be increased if this logic will return simple light type converters based on type
    if (type.typeId) {
        if (type.typeId === PrimitiveTypeId.UUID) {
            return (0, uuid_1.uuidToNative)(value);
        }
        var label = exports.primitiveTypeToValue[type.typeId];
        if (!label) {
            throw new Error("Unknown PrimitiveTypeId: ".concat(type.typeId));
        }
        var input = value[label];
        return objectFromValue(type, valueToNativeConverters[label](input));
    }
    else if (type.decimalType) {
        var high128 = value.high_128;
        var low128 = value.low_128;
        var scale = type.decimalType.scale;
        return (0, decimal_1.toDecimalString)(high128, low128, scale);
    }
    else if (type.optionalType) {
        var innerType = type.optionalType.item;
        if (value.nullFlagValue === NullValue.NULL_VALUE) {
            return null;
        }
        return convertYdbValueToNative(innerType, value);
    }
    else if (type.listType) {
        var innerType_1 = type.listType.item;
        return lodash_1.default.map(value.items, function (item) { return convertYdbValueToNative(innerType_1, item); });
    }
    else if (type.tupleType) {
        var types_1 = type.tupleType.elements;
        var values = value.items;
        return values.map(function (value, index) { return convertYdbValueToNative(types_1[index], value); });
    }
    else if (type.structType) {
        var members_1 = type.structType.members;
        var items = value.items;
        var struct_1 = {};
        items.forEach(function (item, index) {
            var member = members_1[index];
            var memberName = member.name;
            var memberType = member.type;
            struct_1[memberName] = convertYdbValueToNative(memberType, item);
        });
        return struct_1;
    }
    else if (type.dictType) {
        var keyType_1 = type.dictType.key;
        var payloadType_1 = type.dictType.payload;
        var dict_1 = {};
        (_b = value.pairs) === null || _b === void 0 ? void 0 : _b.forEach(function (pair) {
            var nativeKey = convertYdbValueToNative(keyType_1, pair.key);
            dict_1[nativeKey] = convertYdbValueToNative(payloadType_1, pair.payload);
        });
        return dict_1;
    }
    else if (type.variantType) {
        if (type.variantType.tupleItems) {
            var elements = type.variantType.tupleItems.elements;
            var item_1 = value.nestedValue;
            var variantIndex_1 = value.variantIndex;
            return elements.map(function (element, index) {
                if (index === variantIndex_1) {
                    return convertYdbValueToNative(element, item_1);
                }
                return undefined;
            });
        }
        else if (type.variantType.structItems) {
            var members = type.variantType.structItems.members;
            var item = value.nestedValue;
            var variantIndex = value.variantIndex;
            var variantType = members[variantIndex].type;
            var variantName = members[variantIndex].name;
            return _a = {},
                _a[variantName] = convertYdbValueToNative(variantType, item),
                _a;
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
        throw new Error("Unknown type ".concat(JSON.stringify(type)));
    }
}
exports.convertYdbValueToNative = convertYdbValueToNative;
function objectFromValue(type, value) {
    var typeId = type.typeId;
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
            var datetime = value.split(',')[0];
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
    var typeId = type.typeId;
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
            return luxon_1.DateTime.fromJSDate(value, { zone: 'UTC' }).toFormat("yyyy-MM-dd'T'HH:mm:ss',GMT'");
        case PrimitiveTypeId.TZ_TIMESTAMP:
            return value.toISOString().replace('Z', '') + ',GMT';
        default:
            return value;
    }
}
function typeToValue(type, value) {
    var _a;
    if (!type) {
        if (value) {
            throw new Error("Got no type while the value is ".concat(value));
        }
        else {
            throw new Error('Both type and value are empty');
        }
    }
    else if (type.typeId) {
        if (type.typeId === PrimitiveTypeId.UUID) {
            return (0, uuid_1.uuidToValue)(value);
        }
        var valueLabel = exports.primitiveTypeToValue[type.typeId];
        if (valueLabel) {
            return _a = {}, _a[valueLabel] = preparePrimitiveValue(type, value), _a;
        }
        else {
            throw new Error("Unknown PrimitiveTypeId: ".concat(type.typeId));
        }
    }
    else if (type.decimalType) {
        var decimalValue = value;
        var scale = type.decimalType.scale;
        return (0, decimal_1.fromDecimalString)(decimalValue, scale);
    }
    else if (type.optionalType) {
        var innerType = type.optionalType.item;
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
        var listType_1 = type.listType;
        return {
            items: lodash_1.default.map(value, function (item) { return typeToValue(listType_1.item, item); })
        };
    }
    else if (type.tupleType) {
        var elements_1 = type.tupleType.elements;
        return {
            items: lodash_1.default.map(value, function (item, index) { return typeToValue(elements_1[index], item); })
        };
    }
    else if (type.structType) {
        var members = type.structType.members;
        return {
            items: lodash_1.default.map(members, function (member) {
                var memberType = member.type;
                var memberValue = value[member.name];
                return typeToValue(memberType, memberValue);
            }),
        };
    }
    else if (type.dictType) {
        var keyType_2 = type.dictType.key;
        var payloadType_2 = type.dictType.payload;
        return {
            pairs: lodash_1.default.map(lodash_1.default.entries(value), function (_a) {
                var key = _a[0], value = _a[1];
                return ({
                    key: typeToValue(keyType_2, key),
                    payload: typeToValue(payloadType_2, value)
                });
            })
        };
    }
    else if (type.variantType) {
        if (type.variantType.tupleItems) {
            var elements = type.variantType.tupleItems.elements;
            var variantIndex = value.findIndex(function (v) { return v !== undefined; });
            return {
                nestedValue: typeToValue(elements[variantIndex], value[variantIndex]),
                variantIndex: variantIndex,
            };
        }
        else if (type.variantType.structItems) {
            var members = type.variantType.structItems.members;
            var variantKey_1 = Object.keys(value)[0];
            var variantIndex = members.findIndex(function (a) { return variantKey_1 === a.name; });
            if (variantKey_1 === undefined)
                throw new Error("Variant type doesn't have not null fields");
            return {
                nestedValue: typeToValue(members[variantIndex].type, value[variantKey_1]),
                variantIndex: variantIndex,
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
        throw new Error("Unknown type ".concat(JSON.stringify(type)));
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
var TypedData = /** @class */ (function () {
    function TypedData(data) {
        lodash_1.default.assign(this, data);
    }
    TypedData.prototype.getType = function (propertyKey) {
        var typeMeta = Reflect.getMetadata(exports.typeMetadataKey, this, propertyKey);
        if (!typeMeta) {
            throw new Error("Property ".concat(propertyKey, " should be decorated with @declareType!"));
        }
        return typeMeta;
    };
    TypedData.prototype.getValue = function (propertyKey) {
        var type = this.getType(propertyKey);
        return typeToValue(type, this[propertyKey]);
    };
    TypedData.prototype.getTypedValue = function (propertyKey) {
        return {
            type: this.getType(propertyKey),
            value: this.getValue(propertyKey)
        };
    };
    Object.defineProperty(TypedData.prototype, "typedProperties", {
        get: function () {
            var _this = this;
            return lodash_1.default.filter(Reflect.ownKeys(this), function (key) { return (typeof key === 'string' && Reflect.hasMetadata(exports.typeMetadataKey, _this, key)); });
        },
        enumerable: false,
        configurable: true
    });
    TypedData.prototype.getRowType = function () {
        var _this = this;
        var cls = this.constructor;
        var converter = getNameConverter(cls.__options, 'jsToYdb');
        return {
            structType: {
                members: lodash_1.default.map(this.typedProperties, function (propertyKey) { return ({
                    name: converter(propertyKey),
                    type: _this.getType(propertyKey)
                }); })
            }
        };
    };
    TypedData.prototype.getRowValue = function () {
        var _this = this;
        return {
            items: lodash_1.default.map(this.typedProperties, function (propertyKey) {
                return _this.getValue(propertyKey);
            })
        };
    };
    TypedData.createNativeObjects = function (resultSet) {
        var _this = this;
        var rows = resultSet.rows, columns = resultSet.columns;
        if (!columns) {
            return [];
        }
        var converter = getNameConverter(this.__options, 'ydbToJs');
        return lodash_1.default.map(rows, function (row) {
            var obj = lodash_1.default.reduce(row.items, function (acc, value, index) {
                var column = columns[index];
                if (column.name && column.type) {
                    acc[converter(column.name)] = convertYdbValueToNative(column.type, value);
                }
                return acc;
            }, {});
            return new _this(obj);
        });
    };
    TypedData.asTypedCollection = function (collection) {
        return {
            type: {
                listType: {
                    item: collection[0].getRowType()
                }
            },
            value: {
                items: collection.map(function (item) { return item.getRowValue(); })
            }
        };
    };
    TypedData.__options = {};
    return TypedData;
}());
exports.TypedData = TypedData;
