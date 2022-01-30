import {declareType, TypedData, Types} from 'ydb-sdk';

export interface IRow {
    key: string;
    hash: number;
    value: string;
}

export class Row extends TypedData {
    @declareType(Types.UTF8)
    public key: string;

    @declareType(Types.UINT64)
    public hash: number;

    @declareType(Types.UTF8)
    public value: string;

    constructor(data: IRow) {
        super(data);
        this.key = data.key;
        this.hash = data.hash;
        this.value = data.value;
    }
}
