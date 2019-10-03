const {getType} = require('./utils');
const {
    BOOL, INT8, UINT8, INT16, UINT16, INT32, UINT32, INT64, UINT64,
    FLOAT, DOUBLE, DATE, DATETIME, TIMESTAMP, INTERVAL, TZ_DATE, TZ_DATETIME, TZ_TIMESTAMP,
    STRING, UTF8, YSON, JSON, UUID
} = getType('Ydb.Type').PrimitiveTypeId;

const PrimitiveType = {
    Bool: BOOL,
    Int8: INT8,
    Uint8: UINT8,
    Int16: INT16,
    Uint16: UINT16,
    Int32: INT32,
    Uint32: UINT32,
    Int64: INT64,
    Uint64: UINT64,
    Float: FLOAT,
    Double: DOUBLE,
    Date: DATE,
    Datetime: DATETIME,
    Timestamp: TIMESTAMP,
    Interval: INTERVAL,
    TzDate: TZ_DATE,
    TzDatetime: TZ_DATETIME,
    TzTimestamp: TZ_TIMESTAMP,
    String: STRING,
    Utf8: UTF8,
    Yson: YSON,
    Json: JSON,
    Uuid: UUID
};

class OptionalType {
    constructor(type) {
        this.item = type;
    }
}

class Type {
    constructor(item) {
        if (item instanceof OptionalType) {
            this.optional_type = item;
        } else { // primitive type
            this.type_id = item;
        }
    }
}


module.exports = {
    Type,
    OptionalType,
    PrimitiveType
};

