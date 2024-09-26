import {Ydb} from 'ydb-sdk-proto';
import {convertYdbValueToNative, TypedValues, Types} from '../../types';
import Long from 'long';

function testType(name: string, ydbType: Ydb.IType, value: any) {
    return it(name, () => {
        expect(
            convertYdbValueToNative(ydbType, TypedValues.fromNative(ydbType, value).value!),
        ).toStrictEqual(value);
    });
}

describe('Types mutual conversions', () => {
    describe('Primitive values', () => {
        testType('BOOL', Types.BOOL, true);
        testType('BOOL', Types.BOOL, false);
        testType('UINT8', Types.UINT8, 10);
        testType('INT8', Types.INT8, -11);
        testType('UINT16', Types.UINT16, 12);
        testType('INT16', Types.INT16, -13);
        testType('UINT32', Types.UINT32, 14);
        testType('INT32', Types.INT32, -15);
        testType('UINT64', Types.UINT64, 16);
        testType('UINT64', Types.UINT64, 0);
        testType('UINT64 - long - max unsigned', Types.UINT64, Long.MAX_UNSIGNED_VALUE);
        testType('UINT64 - long - max unsigned -1', Types.UINT64, Long.MAX_UNSIGNED_VALUE.sub(1));
        testType('UINT64 - long - max unsigned -2', Types.UINT64, Long.MAX_UNSIGNED_VALUE.sub(2));
        testType('UINT64 - long - max unsigned -3', Types.UINT64, Long.MAX_UNSIGNED_VALUE.sub(3));
        testType('INT64', Types.INT64, 17);
        testType('INT64 - long', Types.INT64, Long.fromInt(-17));
        testType('INT64 - long - max signed', Types.INT64, Long.MAX_VALUE);
        testType('INT64 - long - max signed - 1', Types.INT64, Long.MAX_VALUE.sub(1));
        testType('INT64 - long - min signed', Types.INT64, Long.MIN_VALUE);
        testType('INT64 - long - min signed + 1', Types.INT64, Long.MIN_VALUE.add(1));
        testType('FLOAT', Types.FLOAT, -18.19);
        testType('DOUBLE', Types.DOUBLE, -19.2);
        testType('DYNUMBER', Types.DYNUMBER, '1234567890123e10');
    });

    describe('String values', () => {
        testType('BYTES', Types.BYTES, Buffer.from('abcdefgHkLmn13*#^@*'));
        testType('TEXT', Types.TEXT, 'foo');
        testType('UTF8', Types.UTF8, 'bar');
        testType('YSON', Types.YSON, '<a=1>[3;%false]');
        testType('JSON', Types.JSON, '{"a":1,"b":null}');
        testType('JSON_DOCUMENT', Types.JSON_DOCUMENT, '{"a":1,"b":null}');
    });

    describe('UUID value', () => {
        testType('UUID', Types.UUID, 'f9d5cc3f-f1dc-4d9c-b97e-766e57ca4ccb');

        it('incrorrect UUID', () => {
            expect(() => {
                TypedValues.fromNative(Types.UUID, 'f9d5cc3f-f1dc-4d9c-b97e-766e57ca4ccbe');
            }).toThrow();
        });
    });

    describe('Datetime values', () => {
        it('DATE removes time', () => {
            let v = TypedValues.fromNative(Types.DATE, new Date('2023-01-02Z03:04:05.678Z')).value!;

            v = Ydb.Value.decode(Ydb.Value.encode(v).finish()); // need to manually convert with protobuf lib
            expect(convertYdbValueToNative(Types.DATE, v)).toStrictEqual(new Date('2023-01-02'));
        });
        testType('DATE', Types.DATE, new Date('2023-01-01'));

        it('DATETIME removes milliseconds', () => {
            let v = TypedValues.fromNative(Types.DATETIME, new Date('2023-01-02Z03:04:05.678Z'))
                .value!;

            v = Ydb.Value.decode(Ydb.Value.encode(v).finish()); // need to manually convert with protobuf lib
            expect(convertYdbValueToNative(Types.DATETIME, v)).toStrictEqual(
                new Date('2023-01-02Z03:04:05'),
            );
        });
        ``;
        testType('DATETIME', Types.DATETIME, new Date('2023-01-02Z03:04:05'));
        testType('TIMESTAMP', Types.TIMESTAMP, new Date('2023-01-02T03:04:05.678Z'));
        testType('INTERVAL', Types.INTERVAL, Long.fromValue('93784567890'));
        it('TZ_DATE removes milliseconds', () => {
            expect(
                convertYdbValueToNative(
                    Types.TZ_DATE,
                    TypedValues.fromNative(Types.TZ_DATE, new Date('2023-01-02Z03:04:05.678Z'))
                        .value!,
                ),
            ).toStrictEqual(new Date('2023-01-02'));
        });
        testType('TZ_DATE', Types.TZ_DATE, new Date('2023-01-02'));
        it('TZ_DATETIME removes milliseconds', () => {
            let v = TypedValues.fromNative(Types.TZ_DATETIME, new Date('2023-01-02Z03:04:05.678Z'))
                .value!;

            v = Ydb.Value.decode(Ydb.Value.encode(v).finish()); // need to manually convert with protobuf lib
            expect(convertYdbValueToNative(Types.TZ_DATETIME, v)).toStrictEqual(
                new Date('2023-01-02Z03:04:05'),
            );
        });
        testType('TZ_DATETIME', Types.TZ_DATETIME, new Date('2023-01-02T03:04:05'));
        testType('TZ_TIMESTAMP', Types.TZ_TIMESTAMP, new Date('2023-01-02T03:04:05.678Z'));
    });

    describe('Decimal values', () => {
        testType('decimal(22, 9) - positive', Types.decimal(22, 9), '1');
        testType('decimal(22, 9) - positive', Types.decimal(22, 9), '22.22');
        testType('decimal(22, 9) - positive', Types.decimal(22, 9), '9999999999999.999999999');
        testType('decimal(22, 9) - negative', Types.decimal(22, 9), '-1');
        testType('decimal(22, 9) - negative', Types.decimal(22, 9), '-22.22');
        testType('decimal(22, 9) - negative', Types.decimal(22, 9), '-9999999999999.999999999');
        testType('decimal(5, 2) - 0', Types.decimal(5, 2), '0');
    });

    describe('Optional values', () => {
        testType('Types.optional(Types.UINT64)', Types.optional(Types.UINT64), 1);
        testType('Types.optional(Types.DOUBLE)', Types.optional(Types.DOUBLE), -0.33);
        testType(
            'Types.optional(Types.BYTES)',
            Types.optional(Types.BYTES),
            Buffer.from('abcdefgHkLmn13*#^@*'),
        );
        testType(
            'Types.optional(Types.optional(Types.BYTES))',
            Types.optional(Types.optional(Types.BYTES)),
            Buffer.from('abcdefgHkLmn13*#^@*'),
        );
    });

    describe('Container values', () => {
        testType('Types.list(Types.UINT32)', Types.list(Types.UINT32), [1, 2, 3, 4, 5]);
        testType('Types.tuple(Types.UINT32, Types.TEXT)', Types.tuple(Types.UINT32, Types.TEXT), [
            1,
            '2',
        ]);
        testType(
            'Types.struct(Types.UINT64)',
            Types.struct({
                uint64: Types.UINT64,
                double: Types.DOUBLE,
                bytes: Types.BYTES,
                tuple: Types.tuple(Types.UINT64, Types.TEXT),
            }),
            {
                uint64: Long.MAX_UNSIGNED_VALUE,
                double: 1.23456,
                bytes: Buffer.from('abcdefgHkLmn13*#^@*'),
                tuple: [Long.fromString('18446744073709551615'), 'qwerASDF'],
            },
        );
        // now only simple types allowed
        // for example, can't use Types.tuple(Types.UINT64, Types.TEXT) as key
        // for example, can't use Long as key
        testType('Types.dict(Types.UINT32, Types.TEXT)', Types.dict(Types.UINT32, Types.TEXT), {
            [1844674407370955]: 'qwerASDF',
            [1844674407370954]: 'qwerASDF',
        });
        testType('Void', Types.VOID, null);
    });

    describe('Variant value', () => {
        const variantStructValue = {
            uint64: Long.MAX_UNSIGNED_VALUE,
            double: 1.23456,
            bytes: Buffer.from('abcdefgHkLmn13*#^@*'),
            tuple: [Long.fromString('18446744073709551615'), 'qwerASDF'],
        };
        for (const valueKey of Object.keys(
            variantStructValue,
        ) as (keyof typeof variantStructValue)[]) {
            testType(
                `Variant Types.variant(Types.struct(...))- ${valueKey}`,
                Types.variant(
                    Types.struct({
                        uint64: Types.UINT64,
                        double: Types.DOUBLE,
                        bytes: Types.BYTES,
                        tuple: Types.tuple(Types.UINT64, Types.TEXT),
                    }),
                ),
                {[valueKey]: variantStructValue[valueKey]},
            );
        }
        const variantTupleValues = [
            Long.fromString('18446744073709551613'),
            123456789123450,
            'ABCDEF',
            Buffer.from('Hello Ydb!'),
        ].map((v, i) => [v, i]) as [Ydb.IType, number][];

        for (const [value, idx] of variantTupleValues) {
            const val: any[] = [undefined, undefined, undefined, undefined];
            val[idx] = value;
            testType(
                `Variant Types.variant(Types.tuple(...)) - ${idx}`,
                Types.variant(Types.tuple(Types.UINT64, Types.INT32, Types.TEXT, Types.BYTES)),
                val,
            );
        }
    });

    // TODO: add enum
    // TODO: add tagged
});
