import {declareType, TypedData, Ydb} from 'ydb-sdk';

export interface IRow {
    key: string;
    hash: number;
    value: string;
}

export class Row extends TypedData {
    @declareType({typeId: Ydb.Type.PrimitiveTypeId.UTF8})
    public key: string;

    @declareType({typeId: Ydb.Type.PrimitiveTypeId.UINT64})
    public hash: number;

    @declareType({typeId: Ydb.Type.PrimitiveTypeId.UTF8})
    public value: string;

    constructor(data: IRow) {
        super(data);
        this.key = data.key;
        this.hash = data.hash;
        this.value = data.value;
    }
}
