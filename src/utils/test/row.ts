import {declareType, TypedData, Types} from "../../types";

export interface IRow {
    id: number;
    title: string;
}

export class Row extends TypedData {
    @declareType(Types.UINT64)
    public id: number;

    @declareType(Types.UTF8)
    public title: string;

    constructor(data: IRow) {
        super(data);
        this.id = data.id;
        this.title = data.title;
    }
}

