"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const long_1 = __importDefault(require("long"));
const ydb_sdk_proto_1 = require("ydb-sdk-proto");
const test_utils_1 = require("../test-utils");
const types_1 = require("../types");
var NullValue = ydb_sdk_proto_1.google.protobuf.NullValue;
describe('Types', () => {
    let driver;
    beforeAll(async () => {
        driver = await (0, test_utils_1.initDriver)();
    });
    afterAll(() => (0, test_utils_1.destroyDriver)(driver));
    describe('Convert from native to YDB value', () => {
        describe('Primitive values', () => {
            it('Numeric values', () => {
                expect(types_1.TypedValues.bool(true)).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.BOOL },
                    value: { boolValue: true },
                });
                expect(types_1.TypedValues.uint8(0)).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT8 },
                    value: { uint32Value: 0 },
                });
                expect(types_1.TypedValues.int8(-1)).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.INT8 },
                    value: { int32Value: -1 },
                });
                expect(types_1.TypedValues.uint16(2)).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT16 },
                    value: { uint32Value: 2 },
                });
                expect(types_1.TypedValues.int16(-3)).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.INT16 },
                    value: { int32Value: -3 },
                });
                expect(types_1.TypedValues.uint32(4)).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT32 },
                    value: { uint32Value: 4 },
                });
                expect(types_1.TypedValues.int32(-5)).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.INT32 },
                    value: { int32Value: -5 },
                });
                expect(types_1.TypedValues.uint64(6)).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT64 },
                    value: { uint64Value: 6 },
                });
                expect(types_1.TypedValues.uint64(long_1.default.fromString('18446744073709551615'))).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT64 },
                    value: { uint64Value: long_1.default.fromValue({ high: -1, low: -1, unsigned: false }) },
                });
                expect(types_1.TypedValues.int64(-7)).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.INT64 },
                    value: { int64Value: -7 },
                });
                expect(types_1.TypedValues.float(1.1)).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.FLOAT },
                    value: { floatValue: 1.1 },
                });
                expect(types_1.TypedValues.double(1.1)).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.DOUBLE },
                    value: { doubleValue: 1.1 },
                });
                expect(types_1.TypedValues.dynumber('1.1')).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.DYNUMBER },
                    value: { textValue: '1.1' },
                });
            });
            it('String and bytes values', () => {
                expect(types_1.TypedValues.bytes(Buffer.from('foo'))).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.STRING },
                    value: { bytesValue: Buffer.from('foo') },
                });
                expect(types_1.TypedValues.utf8('hello')).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UTF8 },
                    value: { textValue: 'hello' },
                });
                expect(types_1.TypedValues.text('hello')).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UTF8 },
                    value: { textValue: 'hello' },
                });
                expect(types_1.TypedValues.yson(Buffer.from('<a=1>[3;%false]'))).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.YSON },
                    value: { bytesValue: Buffer.from('<a=1>[3;%false]') },
                });
                expect(types_1.TypedValues.json('{"a":1,"b":null}')).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.JSON },
                    value: { textValue: '{"a":1,"b":null}' },
                });
                expect(types_1.TypedValues.jsonDocument('[]')).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.JSON_DOCUMENT },
                    value: { textValue: '[]' },
                });
            });
            it('UUID value', () => {
                expect(() => {
                    types_1.TypedValues.uuid('abcdefgh-f1dc-4d9ca-b97e-766e57ca.ccb');
                }).toThrow();
                const expectedValue = {
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UUID },
                    value: {
                        low_128: long_1.default.fromValue({
                            low: -103429057,
                            high: 1302131164,
                            unsigned: true
                        }),
                        high_128: long_1.default.fromValue({
                            low: 1853259449,
                            high: -884159913,
                            unsigned: true
                        }),
                    },
                };
                expect(types_1.TypedValues.uuid('f9d5cc3f-f1dc-4d9c-b97e-766e57ca4ccb')).toEqual(expectedValue);
                expect(types_1.TypedValues.uuid('f9d5cc3f-f1dc-4d9c-b97e-766e57ca4ccb'.toUpperCase())).toEqual(expectedValue);
            });
            it('Datetime values', () => {
                expect(types_1.TypedValues.date(new Date('2022-01-01T00:00:00Z'))).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.DATE },
                    value: { uint32Value: 18993 },
                });
                expect(types_1.TypedValues.datetime(new Date('2022-01-01T10:00:00Z'))).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.DATETIME },
                    value: { uint32Value: 1641031200 },
                });
                expect(types_1.TypedValues.timestamp(new Date('2022-01-01T10:00:00.987Z'))).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.TIMESTAMP },
                    value: { uint64Value: 1641031200987000 },
                });
                expect(types_1.TypedValues.interval(93784567890)).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.INTERVAL },
                    value: { int64Value: 93784567890 },
                });
                expect(types_1.TypedValues.tzDate(new Date('2022-01-01T00:00:00Z'))).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.TZ_DATE },
                    value: { textValue: '2022-01-01,GMT' },
                });
                expect(types_1.TypedValues.tzDatetime(new Date('2022-01-01T10:00:00Z'))).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.TZ_DATETIME },
                    value: { textValue: '2022-01-01T10:00:00,GMT' },
                });
                expect(types_1.TypedValues.tzTimestamp(new Date('2022-01-01T10:00:00.987Z'))).toEqual({
                    type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.TZ_TIMESTAMP },
                    value: { textValue: '2022-01-01T10:00:00.987,GMT' },
                });
            });
            it('Decimal values (integration)', async () => {
                await driver.tableClient.withSession(async (session) => {
                    const query = `
                    DECLARE $data AS List<Decimal(22, 9)>;
                    SELECT $data AS data;
                    `;
                    const preparedQuery = await session.prepareQuery(query);
                    const response = await session.executeQuery(preparedQuery, { '$data': types_1.TypedValues.list(types_1.Types.DEFAULT_DECIMAL, ['123', '1.23', '-1', '-1.23']) });
                    const actual = types_1.TypedData.createNativeObjects(response.resultSets[0])[0];
                    const expected = new types_1.TypedData({
                        data: ['123', '1.23', '-1', '-1.23'],
                    });
                    expect(expected).toEqual(actual);
                });
            });
            it('Decimal types', () => {
                expect(() => {
                    types_1.TypedValues.decimal('1e+8');
                }).toThrow();
                expect(types_1.TypedValues.decimal('1.23')).toEqual({
                    type: { decimalType: { precision: 22, scale: 9 } },
                    value: {
                        high_128: long_1.default.fromValue(0),
                        low_128: long_1.default.fromValue('1230000000'),
                    },
                });
                expect(types_1.TypedValues.decimal('1.23', 3, 2)).toEqual({
                    type: { decimalType: { precision: 3, scale: 2 } },
                    value: {
                        high_128: long_1.default.fromValue(0),
                        low_128: long_1.default.fromValue('123'),
                    },
                });
                expect(types_1.TypedValues.decimal('-1')).toEqual({
                    type: { decimalType: { precision: 22, scale: 9 } },
                    value: {
                        high_128: long_1.default.fromValue({ low: -1, high: -1, unsigned: false }),
                        low_128: long_1.default.fromValue({ low: -1000000000, high: -1, unsigned: false }),
                    },
                });
                expect(types_1.TypedValues.decimal('-1.23')).toEqual({
                    type: { decimalType: { precision: 22, scale: 9 } },
                    value: {
                        high_128: long_1.default.fromValue({ low: -1, high: -1, unsigned: false }),
                        low_128: long_1.default.fromValue({ low: -1230000000, high: -1, unsigned: false }),
                    },
                });
            });
            it('Optional values', () => {
                expect(types_1.TypedValues.optional(types_1.TypedValues.uint32(10))).toEqual({
                    type: { optionalType: { item: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT32 } } },
                    value: { uint32Value: 10 },
                });
                expect(types_1.TypedValues.optionalNull(types_1.Types.UINT32)).toEqual({
                    type: { optionalType: { item: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT32 } } },
                    value: { nullFlagValue: 0 },
                });
                expect(types_1.TypedValues.fromNative(types_1.Types.optional(types_1.Types.UINT32), 10)).toEqual({
                    type: { optionalType: { item: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT32 } } },
                    value: { uint32Value: 10 },
                });
                expect(types_1.TypedValues.fromNative(types_1.Types.optional(types_1.Types.UINT32), null)).toEqual({
                    type: { optionalType: { item: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT32 } } },
                    value: { nullFlagValue: 0 },
                });
            });
            it('List value', () => {
                expect(types_1.TypedValues.fromNative(types_1.Types.list(types_1.Types.UINT32), [1, 2, 3])).toEqual({
                    type: { listType: { item: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT32 } } },
                    value: {
                        items: [
                            { uint32Value: 1 },
                            { uint32Value: 2 },
                            { uint32Value: 3 },
                        ],
                    },
                });
                expect(types_1.TypedValues.fromNative(types_1.Types.list(types_1.Types.UINT32), [1, 2, 3])).toEqual(types_1.TypedValues.list(types_1.Types.UINT32, [1, 2, 3]));
            });
            it('Tuple value', () => {
                expect(types_1.TypedValues.fromNative(types_1.Types.tuple(types_1.Types.UINT32, types_1.Types.BOOL), [3, true])).toEqual({
                    type: { tupleType: { elements: [{ typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT32 }, { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.BOOL }] } },
                    value: {
                        items: [
                            { uint32Value: 3 },
                            { boolValue: true },
                        ],
                    },
                });
                expect(types_1.TypedValues.fromNative(types_1.Types.tuple(types_1.Types.UINT32, types_1.Types.BOOL), [3, true])).toEqual(types_1.TypedValues.tuple(types_1.TypedValues.uint32(3), types_1.TypedValues.bool(true)));
            });
            it('Struct value', () => {
                const fields = { a: types_1.Types.UINT32, b: types_1.Types.BOOL };
                expect(types_1.TypedValues.fromNative(types_1.Types.struct(fields), { a: 3, b: true })).toEqual({
                    type: {
                        structType: {
                            members: [
                                { name: 'a', type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT32 } },
                                { name: 'b', type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.BOOL } },
                            ],
                        },
                    },
                    value: {
                        items: [
                            { uint32Value: 3 },
                            { boolValue: true },
                        ],
                    },
                });
                expect(types_1.TypedValues.fromNative(types_1.Types.struct(fields), { a: 3, b: true })).toEqual(types_1.TypedValues.struct(fields, { a: 3, b: true }));
            });
            it('Dict value', () => {
                expect(types_1.TypedValues.fromNative(types_1.Types.dict(types_1.Types.UTF8, types_1.Types.UINT32), {
                    a: 1,
                    b: 2,
                    c: 3
                })).toEqual({
                    type: {
                        dictType: {
                            key: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UTF8 },
                            payload: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT32 },
                        },
                    },
                    value: {
                        pairs: [
                            { key: { textValue: 'a' }, payload: { uint32Value: 1 } },
                            { key: { textValue: 'b' }, payload: { uint32Value: 2 } },
                            { key: { textValue: 'c' }, payload: { uint32Value: 3 } },
                        ],
                    },
                });
                expect(types_1.TypedValues.fromNative(types_1.Types.dict(types_1.Types.UTF8, types_1.Types.UINT32), {
                    a: 1,
                    b: 2,
                    c: 3
                })).toEqual(types_1.TypedValues.dict(types_1.Types.UTF8, types_1.Types.UINT32, { a: 1, b: 2, c: 3 }));
            });
            it('Tuple variant value', () => {
                expect(types_1.TypedValues.fromNative(types_1.Types.variant(types_1.Types.tuple(types_1.Types.UINT32, types_1.Types.BOOL)), [
                    3,
                    null,
                ])).toEqual({
                    type: {
                        variantType: {
                            tupleItems: {
                                elements: [
                                    { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT32 },
                                    { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.BOOL },
                                ],
                            },
                        },
                    },
                    value: {
                        variantIndex: 0,
                        nestedValue: { uint32Value: 3 },
                    },
                });
            });
            it('Struct variant value', () => {
                expect(types_1.TypedValues.fromNative(types_1.Types.variant(types_1.Types.struct({ a: types_1.Types.UINT32, b: types_1.Types.BOOL })), { a: 3 })).toEqual({
                    type: {
                        variantType: {
                            structItems: {
                                members: [
                                    { name: 'a', type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.UINT32 } },
                                    { name: 'b', type: { typeId: ydb_sdk_proto_1.Ydb.Type.PrimitiveTypeId.BOOL } },
                                ],
                            },
                        },
                    },
                    value: {
                        variantIndex: 0,
                        nestedValue: { uint32Value: 3 },
                    },
                });
            });
            it('Void value', () => {
                expect(types_1.TypedValues.VOID).toEqual({
                    type: { voidType: NullValue.NULL_VALUE },
                    value: {
                        nullFlagValue: NullValue.NULL_VALUE,
                    },
                });
            });
        });
    });
    describe('Convert from YDB to native value', () => {
        describe('Primitive values', () => {
            it('Numeric values', async () => {
                await driver.tableClient.withSession(async (session) => {
                    const query = `
                    SELECT
                        Bool("true") AS bool_value,
                        Uint8("0") AS uint8_value,
                        Int8("-1") AS int8_value,
                        Uint16("2") AS uint16_value,
                        Int16("-3") AS int16_value,
                        Uint32("4") AS uint32_value,
                        Int32("-5") AS int32_value,
                        Uint64("6") AS uint64_value,
                        Uint64("18446744073709551613") AS uint64_long_value,
                        Int64("7") AS int64_value,
                        Int64("-7") AS int64_long_value,
                        Float("-1.1") AS float_value,
                        Double("-1.1") AS double_value,
                        DyNumber("1234567890.123") AS dynumber_value;`;
                    const data = {
                        bool_value: true,
                        uint8_value: 0,
                        int8_value: -1,
                        uint16_value: 2,
                        int16_value: -3,
                        uint32_value: 4,
                        int32_value: -5,
                        uint64_value: 6,
                        uint64_long_value: long_1.default.MAX_UNSIGNED_VALUE.sub(2),
                        int64_value: 7,
                        int64_long_value: long_1.default.fromValue(-7),
                        float_value: -1.100000023841858,
                        double_value: -1.1,
                        dynumber_value: '.1234567890123e10',
                    };
                    const response = await session.executeQuery(query);
                    const actual = types_1.TypedData.createNativeObjects(response.resultSets[0])[0];
                    const expected = new types_1.TypedData(data);
                    expect(expected).toEqual(actual);
                });
            });
            it('String values', async () => {
                await driver.tableClient.withSession(async (session) => {
                    const query = `
                SELECT
                    String("foo") AS string_value,
                    Utf8("hello") AS utf8_value,
                    Yson("<a=1>[3;%false]") AS yson_value,
                    Json(@@{"a":1,"b":null}@@) AS json_value,
                    JsonDocument("[]") AS json_document_value;`;
                    const data = {
                        string_value: Buffer.from('foo'),
                        utf8_value: 'hello',
                        yson_value: '<a=1>[3;%false]',
                        json_value: '{"a":1,"b":null}',
                        json_document_value: '[]',
                    };
                    const response = await session.executeQuery(query);
                    const actual = types_1.TypedData.createNativeObjects(response.resultSets[0]);
                    const expected = [new types_1.TypedData(data)];
                    expect(expected).toEqual(actual);
                });
            });
            it('UUID value', async () => {
                await driver.tableClient.withSession(async (session) => {
                    const query = `SELECT Uuid("f9d5cc3f-f1dc-4d9c-b97e-766e57ca4ccb") AS uuid_value;`;
                    const data = {
                        uuid_value: 'f9d5cc3f-f1dc-4d9c-b97e-766e57ca4ccb',
                    };
                    const response = await session.executeQuery(query);
                    const actual = types_1.TypedData.createNativeObjects(response.resultSets[0]);
                    const expected = [new types_1.TypedData(data)];
                    expect(expected).toEqual(actual);
                });
            });
            it('Datetime values', async () => {
                await driver.tableClient.withSession(async (session) => {
                    const query = `
                SELECT
                    Date("2022-01-01") AS date_value,
                    Datetime("2022-01-01T10:00:00Z") AS datetime_value,
                    Timestamp("2022-01-01T10:00:00.987Z") AS timestamp_value,
                    Interval("P1DT2H3M4.567890S") AS interval_value,
                    TzDate("2022-01-01,Europe/Moscow") AS tz_date_value,
                    TzDatetime("2022-01-01T10:00:00,America/Los_Angeles") AS tz_datetime_value,
                    TzTimestamp("2022-01-01T10:00:00.987,GMT") AS tz_timestamp_value;`;
                    const data = {
                        date_value: new Date('2022-01-01:00:00:00Z'),
                        datetime_value: new Date('2022-01-01T10:00:00.000Z'),
                        timestamp_value: new Date('2022-01-01T10:00:00.987Z'),
                        interval_value: long_1.default.fromValue('93784567890'),
                        tz_date_value: new Date('2022-01-01T00:00:00Z'),
                        tz_datetime_value: new Date('2022-01-01T10:00:00.000Z'),
                        tz_timestamp_value: new Date('2022-01-01T10:00:00.987Z'),
                    };
                    const response = await session.executeQuery(query);
                    const actual = types_1.TypedData.createNativeObjects(response.resultSets[0]);
                    const expected = [new types_1.TypedData(data)];
                    expect(expected).toEqual(actual);
                });
            });
        });
        it('Decimal values', async () => {
            await driver.tableClient.withSession(async (session) => {
                const query = `
                SELECT
                    Decimal("123", 22, 9) AS val1,
                    Decimal("123", 22, 0) AS val2,
                    Decimal("1.23", 22, 9) AS val3,
                    Decimal("1.23", 3, 2) AS val4,
                    Decimal("-1", 22, 9) AS val5,
                    Decimal("-1.23", 22, 9) AS val6
                ;`;
                const data = {
                    val1: '123',
                    val2: '123',
                    val3: '1.23',
                    val4: '1.23',
                    val5: '-1',
                    val6: '-1.23',
                };
                const response = await session.executeQuery(query);
                const actual = types_1.TypedData.createNativeObjects(response.resultSets[0]);
                const expected = [new types_1.TypedData(data)];
                expect(expected).toEqual(actual);
            });
        });
        it('Optional values', async () => {
            await driver.tableClient.withSession(async (session) => {
                const query = `
            SELECT
                CAST(1 AS Optional<Uint64>) AS optional_value,
                CAST(NULL AS Optional<Uint64>) AS optional_null_value;`;
                const data = {
                    optional_value: 1,
                    optional_null_value: null,
                };
                const response = await session.executeQuery(query);
                const actual = types_1.TypedData.createNativeObjects(response.resultSets[0]);
                const expected = [new types_1.TypedData(data)];
                expect(expected).toEqual(actual);
            });
        });
        it('Container values', async () => {
            await driver.tableClient.withSession(async (session) => {
                const query = `
            SELECT
                AsList(1, 2, 3) AS list_value,
                AsTuple(1, 2, "3") AS tuple_value,
                AsStruct(1 AS a, 2 AS b, "3" AS c) AS struct_value,
                AsDict(AsTuple("a", 1), AsTuple("b", 2), AsTuple("c", 3)) AS dict_value
            ;`;
                const data = {
                    list_value: [1, 2, 3],
                    tuple_value: [1, 2, Buffer.from('3')],
                    struct_value: { a: 1, b: 2, c: Buffer.from('3') },
                    dict_value: { a: 1, b: 2, c: 3 },
                };
                const response = await session.executeQuery(query);
                const actual = types_1.TypedData.createNativeObjects(response.resultSets[0]);
                const expected = [new types_1.TypedData(data)];
                expect(expected).toEqual(actual);
            });
        });
        it('Void value', async () => {
            await driver.tableClient.withSession(async (session) => {
                const query = 'SELECT Void() as void_value;';
                const data = {
                    void_value: null,
                };
                const response = await session.executeQuery(query);
                const actual = types_1.TypedData.createNativeObjects(response.resultSets[0]);
                const expected = [new types_1.TypedData(data)];
                expect(expected).toEqual(actual);
            });
        });
        it('Variant value', async () => {
            await driver.tableClient.withSession(async (session) => {
                const query = `$var_type_struct = Variant<foo: Int32, bar: Bool>;
                $var_type_tuple = Variant<Int32,String>;
                SELECT
                    Variant(6, "foo", $var_type_struct) as v1,
                    Variant(false, "bar", $var_type_struct) as v2,
                    Variant(-123, "0", $var_type_tuple) as v3,
                    Variant("abcdef", "1", $var_type_tuple) as v4;`;
                const data = {
                    v1: { foo: 6 },
                    v2: { bar: false },
                    v3: [-123, undefined],
                    v4: [undefined, Buffer.from('abcdef')],
                };
                const response = await session.executeQuery(query);
                const actual = types_1.TypedData.createNativeObjects(response.resultSets[0]);
                const expected = [new types_1.TypedData(data)];
                expect(expected).toEqual(actual);
            });
        });
        it('Variant YDB -> SDK value', async () => {
            await driver.tableClient.withSession(async (session) => {
                const query = `$var_type_struct = Variant<foo: UInt32, bar: Text>;
                $var_type_tuple = Variant<Int32,Bool>;
                SELECT
                    Variant(12345678, "foo", $var_type_struct) as v1,
                    Variant("AbCdEfGh", "bar", $var_type_struct) as v2,
                    Variant(-12345678, "0", $var_type_tuple) as v3,
                    Variant(false, "1", $var_type_tuple) as v4;`;
                const sdkValues = {
                    v1: types_1.TypedValues.fromNative(types_1.Types.variant(types_1.Types.struct({ foo: types_1.Types.UINT32, bar: types_1.Types.TEXT })), { foo: 12345678 }),
                    v2: types_1.TypedValues.fromNative(types_1.Types.variant(types_1.Types.struct({ foo: types_1.Types.UINT32, bar: types_1.Types.TEXT })), { bar: 'AbCdEfGh' }),
                    v3: types_1.TypedValues.fromNative(types_1.Types.variant(types_1.Types.tuple(types_1.Types.INT32, types_1.Types.BOOL)), [-12345678, undefined]),
                    v4: types_1.TypedValues.fromNative(types_1.Types.variant(types_1.Types.tuple(types_1.Types.INT32, types_1.Types.BOOL)), [undefined, false]),
                };
                const response = await session.executeQuery(query);
                const actual = types_1.TypedData.createNativeObjects(response.resultSets[0]);
                Object.values(sdkValues).map((v, idx) => {
                    var _a, _b, _c, _d;
                    expect(JSON.stringify((_a = v.value) === null || _a === void 0 ? void 0 : _a.nestedValue)).toEqual(JSON.stringify((_d = (_c = (_b = response.resultSets[0].rows) === null || _b === void 0 ? void 0 : _b[0].items) === null || _c === void 0 ? void 0 : _c[idx]) === null || _d === void 0 ? void 0 : _d.nestedValue));
                });
                expect(actual).toEqual([
                    {
                        v1: { foo: 12345678 },
                        v2: { bar: 'AbCdEfGh' },
                        v3: [-12345678, undefined],
                        v4: [undefined, false],
                    },
                ]);
            });
        });
        // // TODO: Enable in future versions of YDB
        // // now throws error `Failed to export parameter type: $var1
        // // Unsupported protobuf type: Variant<'bar':Bool,'foo':Int32>`
        // it('Variant SDK -> YDB value', async () => {
        //     await driver.tableClient.withSession(async (session) => {
        //         const query = `
        //         DECLARE $var1 AS Variant<foo: Int32, bar: Bool>;
        //         DECLARE $var2 AS Variant<foo: Int32, bar: Bool>;
        //         DECLARE $var3 AS Variant<Int32,Text>;
        //         DECLARE $var4 AS Variant<Int32,Text>;
        //         SELECT $var1 as var1, $var2 as var2, $var3 as var3, $var4 as var4;`;
        //         const structVariantType = Types.variant(
        //             Types.struct({foo: Types.INT32, bar: Types.BOOL}),
        //         );
        //         const tupleVariantType = Types.variant(Types.tuple(Types.INT32, Types.TEXT));
        //         const params = {
        //             $var1: TypedValues.fromNative(structVariantType, {foo: 12345678}),
        //             $var2: TypedValues.fromNative(structVariantType, {bar: 'AbCdEfGh'}),
        //             $var3: TypedValues.fromNative(tupleVariantType, [333, undefined]),
        //             $var4: TypedValues.fromNative(tupleVariantType, [undefined, '444']),
        //         };
        //         const response = await session.executeQuery(query, params);
        //         const actual = TypedData.createNativeObjects(response.resultSets[0]);
        //         const data = {
        //             var1: {foo: 6},
        //             var2: {bar: false},
        //             var3: [-123, null],
        //             var4: [null, 'abcdef'],
        //         };
        //         const expected = [new TypedData(data)];
        //         expect(expected).toEqual(actual);
        //     });
        // });
        it('Enum value', async () => {
            await driver.tableClient.withSession(async (session) => {
                const query = `$enum_type = Enum<Foo, Bar>;
                SELECT
                   Enum("Foo", $enum_type) as e1,
                   Enum("Bar", $enum_type) as e2;`;
                const data = { e1: { Foo: null }, e2: { Bar: null } };
                const response = await session.executeQuery(query);
                const actual = types_1.TypedData.createNativeObjects(response.resultSets[0]);
                const expected = [new types_1.TypedData(data)];
                expect(expected).toEqual(actual);
            });
        });
        // // TODO: Enable in future versions of YDB
        // // now it just returns usual value and there is no way to determine tag
        // it('Tagged value', async () => {
        //     await driver.tableClient.withSession(async (session) => {
        //         const query = 'SELECT AsTagged(1, "Foo") as tagged_value;';
        //         const data = {
        //             tagged_value: 1,
        //         };
        //         const response = await session.executeQuery(query);
        //         const actual = TypedData.createNativeObjects(response.resultSets[0]);
        //         const expected = [new TypedData(data)];
        //         expect(expected).toEqual(actual);
        //     });
        // });
    });
});
