import {Ydb} from "ydb-sdk-proto";
import {IAsyncQueueIterator} from "../utils/build-async-queue-iterator";
import * as symbols from './symbols';


// TODO: Support from TypedData

export class ResultSet {

    public readonly index: number;
    public readonly columns: Ydb.IColumn[]
    public readonly rows: AsyncGenerator<Ydb.IValue, void>;

    private constructor(
        index: number,
        columns: Ydb.IColumn[],
        rowsIterator: IAsyncQueueIterator<Ydb.IValue>
    ) {
        this.index = index;
        this.columns = columns;
        this.rows = rowsIterator[Symbol.asyncIterator]();
    }

    static [symbols.create](
        index: number,
        columns: Ydb.IColumn[],
        rowsIterator: IAsyncQueueIterator<Ydb.IValue>
    ) {
        return new ResultSet(index, columns, rowsIterator);
    }
}
