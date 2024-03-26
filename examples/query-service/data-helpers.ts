import {declareType, TypedData, Types} from "ydb-sdk";

interface IRow {
    id: number;
    rowTitle: string;
    time: Date;
}

export class Row extends TypedData {
    @declareType(Types.UINT64)
    public id: number;

    @declareType(Types.UTF8)
    public rowTitle: string;

    @declareType(Types.DATETIME)
    public time: Date;

    constructor(data: IRow) {
        super(data);
        this.id = data.id;
        this.rowTitle = data.rowTitle;
        this.time = data.time;
    }
}
