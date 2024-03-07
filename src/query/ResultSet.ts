import {Ydb} from "ydb-sdk-proto";
import {IAsyncQueueIterator} from "../utils/build-async-queue-iterator";

// TODO: Support from TypedData

export class ResultSet {

    public readonly index: number;
    public readonly columns: Ydb.IColumn[]
    public readonly rows: AsyncGenerator<Ydb.IValue, void>;
    public execStats?: Ydb.TableStats.IQueryStats; // TODO: Check that it comes for every resultSet

    constructor(
        index: number,
        columns: Ydb.IColumn[],
        rowsIterator: IAsyncQueueIterator<Ydb.IValue>
    ) {
        this.index = index;
        this.columns = columns;
        this.rows = rowsIterator[Symbol.asyncIterator]();
    }
}
