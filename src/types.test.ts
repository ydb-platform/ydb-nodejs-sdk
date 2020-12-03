import {declareType, TypedData} from './types';
import {Ydb} from "../proto/bundle";

const Type = Ydb.Type;


class TestTypedData extends TypedData {

    @declareType({typeId: Type.PrimitiveTypeId.UTF8})
    public bool: boolean;
    @declareType({typeId: Type.PrimitiveTypeId.INT8})
    public int8: number;
    @declareType({typeId: Type.PrimitiveTypeId.UINT8})
    public uint8: number;
    @declareType({typeId: Type.PrimitiveTypeId.INT16})
    public int16: number;
    @declareType({typeId: Type.PrimitiveTypeId.UINT16})
    public uint16: number;
    @declareType({typeId: Type.PrimitiveTypeId.INT32})
    public int32: number;
    @declareType({typeId: Type.PrimitiveTypeId.UINT32})
    public uint32: number;
    @declareType({typeId: Type.PrimitiveTypeId.INT64})
    public int64: number;
    @declareType({typeId: Type.PrimitiveTypeId.UINT64})
    public uint64: number;
    @declareType({typeId: Type.PrimitiveTypeId.FLOAT})
    public float: number;
    @declareType({typeId: Type.PrimitiveTypeId.DOUBLE})
    public double: number;
    @declareType({typeId: Type.PrimitiveTypeId.DATE})
    public date: string;
    @declareType({typeId: Type.PrimitiveTypeId.DATETIME})
    public datetime: string;
    @declareType({typeId: Type.PrimitiveTypeId.TIMESTAMP})
    public timestamp: string;
    @declareType({typeId: Type.PrimitiveTypeId.INTERVAL})
    public interval: number;
    @declareType({typeId: Type.PrimitiveTypeId.TZ_DATE})
    public tzDate: string;
    @declareType({typeId: Type.PrimitiveTypeId.TZ_DATETIME})
    public tzDatetime: string;
    @declareType({typeId: Type.PrimitiveTypeId.TZ_TIMESTAMP})
    public tzTimestamp: string;
    @declareType({typeId: Type.PrimitiveTypeId.STRING})
    public string: string;
    @declareType({typeId: Type.PrimitiveTypeId.UTF8})
    public utf8: string;
    @declareType({typeId: Type.PrimitiveTypeId.YSON})
    public yson: object;
    @declareType({typeId: Type.PrimitiveTypeId.JSON})
    public json: object;
    @declareType({typeId: Type.PrimitiveTypeId.UUID})
    public uuid: string;

    @declareType({optionalType: {item: {typeId: Type.PrimitiveTypeId.UTF8}}})
    public opt: string | null;

    @declareType({optionalType: {item: {typeId: Type.PrimitiveTypeId.UTF8}}})
    public undef?: string;
    @declareType({optionalType: {item: {typeId: Type.PrimitiveTypeId.UTF8}}})
    public empty?: string;
    @declareType({optionalType: {item: {typeId: Type.PrimitiveTypeId.UINT64}}})
    public zero?: number;

    constructor() {
        super({});
        this.bool = true;
        this.int8 = 1;
        this.uint8 = 1;
        this.int16 = 1;
        this.uint16 = 1;
        this.int32 = 1;
        this.uint32 = 1;
        this.int64 = 1;
        this.uint64 = 1;
        this.float = 1;
        this.double = 1;
        this.date = "2020-04-15";
        this.datetime = "2020-04-15T15:58:22Z";
        this.timestamp = "2020-04-15T15:58:22.504185Z";
        this.interval = 12345;
        this.tzDate = '2020-01-01,GMT';
        this.tzDatetime = "2020-01-01T01:02:03,Europe/Moscow";
        this.tzTimestamp = "2020-01-01T01:02:03.456789,Europe/Moscow";
        this.string = "foo";
        this.utf8 = "foo";
        this.yson = {foo: "bar"};
        this.json = {foo: "bar"};
        this.uuid = "DBD7334D-7A87-43D5-80BF-DC70EF27BFAC";
        this.opt = null;
        this.empty = "";
        this.zero = 0;
    }
}

test('Convert typeToValue', () => {

    const td = new TestTypedData();

    expect(td.getRowValue()).toEqual({
        "items": [
            {
                "textValue": true
            },
            {
                "int32Value": 1
            },
            {
                "uint32Value": 1
            },
            {
                "int32Value": 1
            },
            {
                "uint32Value": 1
            },
            {
                "int32Value": 1
            },
            {
                "uint32Value": 1
            },
            {
                "int64Value": 1
            },
            {
                "uint64Value": 1
            },
            {
                "floatValue": 1
            },
            {
                "doubleValue": 1
            },
            {
                "uint32Value": "2020-04-15"
            },
            {
                "uint32Value": "2020-04-15T15:58:22Z"
            },
            {
                "uint64Value": "2020-04-15T15:58:22.504185Z"
            },
            {
                "uint64Value": 12345
            },
            {
                "uint32Value": "2020-01-01,GMT"
            },
            {
                "uint32Value": "2020-01-01T01:02:03,Europe/Moscow"
            },
            {
                "uint64Value": "2020-01-01T01:02:03.456789,Europe/Moscow"
            },
            {
                "bytesValue": "foo"
            },
            {
                "textValue": "foo"
            },
            {
                "bytesValue": {
                    "foo": "bar"
                }
            },
            {
                "textValue": {
                    "foo": "bar"
                }
            },
            {
                "textValue": "DBD7334D-7A87-43D5-80BF-DC70EF27BFAC"
            },
            {
                "nullFlagValue": 0
            },
            {
                "nullFlagValue": 0
            },
            {
                "textValue": ""
            },
            {
                "uint64Value": 0
            }
        ]
    })
});
