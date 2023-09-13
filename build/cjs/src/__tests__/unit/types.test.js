"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ydb_sdk_proto_1 = require("ydb-sdk-proto");
const types_1 = require("../../types");
const long_1 = __importDefault(require("long"));
function testType(name, ydbType, value) {
    return it(name, () => {
        expect((0, types_1.convertYdbValueToNative)(ydbType, types_1.TypedValues.fromNative(ydbType, value).value)).toStrictEqual(value);
    });
}
describe('Types mutual conversions', () => {
    describe('Primitive values', () => {
        testType('BOOL', types_1.Types.BOOL, true);
        testType('BOOL', types_1.Types.BOOL, false);
        testType('UINT8', types_1.Types.UINT8, 10);
        testType('INT8', types_1.Types.INT8, -11);
        testType('UINT16', types_1.Types.UINT16, 12);
        testType('INT16', types_1.Types.INT16, -13);
        testType('UINT32', types_1.Types.UINT32, 14);
        testType('INT32', types_1.Types.INT32, -15);
        testType('UINT64', types_1.Types.UINT64, 16);
        testType('UINT64', types_1.Types.UINT64, 0);
        testType('UINT64 - long - max unsigned', types_1.Types.UINT64, long_1.default.MAX_UNSIGNED_VALUE);
        testType('UINT64 - long - max unsigned -1', types_1.Types.UINT64, long_1.default.MAX_UNSIGNED_VALUE.sub(1));
        testType('UINT64 - long - max unsigned -2', types_1.Types.UINT64, long_1.default.MAX_UNSIGNED_VALUE.sub(2));
        testType('UINT64 - long - max unsigned -3', types_1.Types.UINT64, long_1.default.MAX_UNSIGNED_VALUE.sub(3));
        testType('INT64', types_1.Types.INT64, 17);
        testType('INT64 - long', types_1.Types.INT64, long_1.default.fromInt(-17));
        testType('INT64 - long - max signed', types_1.Types.INT64, long_1.default.MAX_VALUE);
        testType('INT64 - long - max signed - 1', types_1.Types.INT64, long_1.default.MAX_VALUE.sub(1));
        testType('INT64 - long - min signed', types_1.Types.INT64, long_1.default.MIN_VALUE);
        testType('INT64 - long - min signed + 1', types_1.Types.INT64, long_1.default.MIN_VALUE.add(1));
        testType('FLOAT', types_1.Types.FLOAT, -18.19);
        testType('DOUBLE', types_1.Types.DOUBLE, -19.2);
        testType('DYNUMBER', types_1.Types.DYNUMBER, '1234567890123e10');
    });
    describe('String values', () => {
        testType('BYTES', types_1.Types.BYTES, Buffer.from('abcdefgHkLmn13*#^@*'));
        testType('TEXT', types_1.Types.TEXT, 'foo');
        testType('UTF8', types_1.Types.UTF8, 'bar');
        testType('YSON', types_1.Types.YSON, '<a=1>[3;%false]');
        testType('JSON', types_1.Types.JSON, '{"a":1,"b":null}');
        testType('JSON_DOCUMENT', types_1.Types.JSON_DOCUMENT, '{"a":1,"b":null}');
    });
    describe('UUID value', () => {
        testType('UUID', types_1.Types.UUID, 'f9d5cc3f-f1dc-4d9c-b97e-766e57ca4ccb');
        it('incrorrect UUID', () => {
            expect(() => {
                types_1.TypedValues.fromNative(types_1.Types.UUID, 'f9d5cc3f-f1dc-4d9c-b97e-766e57ca4ccbe');
            }).toThrow();
        });
    });
    describe('Datetime values', () => {
        it('DATE removes time', () => {
            let v = types_1.TypedValues.fromNative(types_1.Types.DATE, new Date('2023-01-02Z03:04:05.678Z')).value;
            v = ydb_sdk_proto_1.Ydb.Value.decode(ydb_sdk_proto_1.Ydb.Value.encode(v).finish()); // need to manually convert with protobuf lib
            expect((0, types_1.convertYdbValueToNative)(types_1.Types.DATE, v)).toStrictEqual(new Date('2023-01-02'));
        });
        testType('DATE', types_1.Types.DATE, new Date('2023-01-01'));
        it('DATETIME removes milliseconds', () => {
            let v = types_1.TypedValues.fromNative(types_1.Types.DATETIME, new Date('2023-01-02Z03:04:05.678Z'))
                .value;
            v = ydb_sdk_proto_1.Ydb.Value.decode(ydb_sdk_proto_1.Ydb.Value.encode(v).finish()); // need to manually convert with protobuf lib
            expect((0, types_1.convertYdbValueToNative)(types_1.Types.DATETIME, v)).toStrictEqual(new Date('2023-01-02Z03:04:05'));
        });
        ``;
        testType('DATETIME', types_1.Types.DATETIME, new Date('2023-01-02Z03:04:05'));
        testType('TIMESTAMP', types_1.Types.TIMESTAMP, new Date('2023-01-02T03:04:05.678Z'));
        testType('INTERVAL', types_1.Types.INTERVAL, long_1.default.fromValue('93784567890'));
        it('TZ_DATE removes milliseconds', () => {
            expect((0, types_1.convertYdbValueToNative)(types_1.Types.TZ_DATE, types_1.TypedValues.fromNative(types_1.Types.TZ_DATE, new Date('2023-01-02Z03:04:05.678Z'))
                .value)).toStrictEqual(new Date('2023-01-02'));
        });
        testType('TZ_DATE', types_1.Types.TZ_DATE, new Date('2023-01-02'));
        it('TZ_DATETIME removes milliseconds', () => {
            let v = types_1.TypedValues.fromNative(types_1.Types.TZ_DATETIME, new Date('2023-01-02Z03:04:05.678Z'))
                .value;
            v = ydb_sdk_proto_1.Ydb.Value.decode(ydb_sdk_proto_1.Ydb.Value.encode(v).finish()); // need to manually convert with protobuf lib
            expect((0, types_1.convertYdbValueToNative)(types_1.Types.TZ_DATETIME, v)).toStrictEqual(new Date('2023-01-02Z03:04:05'));
        });
        testType('TZ_DATETIME', types_1.Types.TZ_DATETIME, new Date('2023-01-02T03:04:05'));
        testType('TZ_TIMESTAMP', types_1.Types.TZ_TIMESTAMP, new Date('2023-01-02T03:04:05.678Z'));
    });
    describe('Decimal values', () => {
        testType('decimal(22, 9) - positive', types_1.Types.decimal(22, 9), '1');
        testType('decimal(22, 9) - positive', types_1.Types.decimal(22, 9), '22.22');
        testType('decimal(22, 9) - positive', types_1.Types.decimal(22, 9), '9999999999999.999999999');
        testType('decimal(22, 9) - negative', types_1.Types.decimal(22, 9), '-1');
        testType('decimal(22, 9) - negative', types_1.Types.decimal(22, 9), '-22.22');
        testType('decimal(22, 9) - negative', types_1.Types.decimal(22, 9), '-9999999999999.999999999');
        testType('decimal(5, 2) - 0', types_1.Types.decimal(5, 2), '0');
    });
    describe('Optional values', () => {
        testType('Types.optional(Types.UINT64)', types_1.Types.optional(types_1.Types.UINT64), 1);
        testType('Types.optional(Types.DOUBLE)', types_1.Types.optional(types_1.Types.DOUBLE), -0.33);
        testType('Types.optional(Types.BYTES)', types_1.Types.optional(types_1.Types.BYTES), Buffer.from('abcdefgHkLmn13*#^@*'));
        testType('Types.optional(Types.optional(Types.BYTES))', types_1.Types.optional(types_1.Types.optional(types_1.Types.BYTES)), Buffer.from('abcdefgHkLmn13*#^@*'));
    });
    describe('Container values', () => {
        testType('Types.list(Types.UINT32)', types_1.Types.list(types_1.Types.UINT32), [1, 2, 3, 4, 5]);
        testType('Types.tuple(Types.UINT32, Types.TEXT)', types_1.Types.tuple(types_1.Types.UINT32, types_1.Types.TEXT), [
            1,
            '2',
        ]);
        testType('Types.struct(Types.UINT64)', types_1.Types.struct({
            uint64: types_1.Types.UINT64,
            double: types_1.Types.DOUBLE,
            bytes: types_1.Types.BYTES,
            tuple: types_1.Types.tuple(types_1.Types.UINT64, types_1.Types.TEXT),
        }), {
            uint64: long_1.default.MAX_UNSIGNED_VALUE,
            double: 1.23456,
            bytes: Buffer.from('abcdefgHkLmn13*#^@*'),
            tuple: [long_1.default.fromString('18446744073709551615'), 'qwerASDF'],
        });
        // now only simple types allowed
        // for example, can't use Types.tuple(Types.UINT64, Types.TEXT) as key
        // for example, can't use Long as key
        testType('Types.dict(Types.UINT32, Types.TEXT)', types_1.Types.dict(types_1.Types.UINT32, types_1.Types.TEXT), {
            [1844674407370955]: 'qwerASDF',
            [1844674407370954]: 'qwerASDF',
        });
        testType('Void', types_1.Types.VOID, null);
    });
    describe('Variant value', () => {
        const variantStructValue = {
            uint64: long_1.default.MAX_UNSIGNED_VALUE,
            double: 1.23456,
            bytes: Buffer.from('abcdefgHkLmn13*#^@*'),
            tuple: [long_1.default.fromString('18446744073709551615'), 'qwerASDF'],
        };
        for (const valueKey of Object.keys(variantStructValue)) {
            testType(`Variant Types.variant(Types.struct(...))- ${valueKey}`, types_1.Types.variant(types_1.Types.struct({
                uint64: types_1.Types.UINT64,
                double: types_1.Types.DOUBLE,
                bytes: types_1.Types.BYTES,
                tuple: types_1.Types.tuple(types_1.Types.UINT64, types_1.Types.TEXT),
            })), { [valueKey]: variantStructValue[valueKey] });
        }
        const variantTupleValues = [
            long_1.default.fromString('18446744073709551613'),
            123456789123450,
            'ABCDEF',
            Buffer.from('Hello Ydb!'),
        ].map((v, i) => [v, i]);
        for (const [value, idx] of variantTupleValues) {
            const val = [undefined, undefined, undefined, undefined];
            val[idx] = value;
            testType(`Variant Types.variant(Types.tuple(...)) - ${idx}`, types_1.Types.variant(types_1.Types.tuple(types_1.Types.UINT64, types_1.Types.INT32, types_1.Types.TEXT, types_1.Types.BYTES)), val);
        }
    });
    // TODO: add enum
    // TODO: add tagged
});
