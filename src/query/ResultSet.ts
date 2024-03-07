import {Ydb} from "ydb-sdk-proto";
import {IAsyncQueueIterator} from "../utils/build-async-queue-iterator";
import Long from "long";

export class ResultSet {

    public readonly index: number;
    public readonly columns: Ydb.IColumn[]
    public readonly rows: AsyncGenerator<Ydb.IValue, void>;
    public execStats?: Ydb.TableStats.IQueryStats;

    constructor(
        resultSetIndex: number | Long,
        _columns: Ydb.IColumn[],
        public _rowsIterator: IAsyncQueueIterator<Ydb.IValue>
    ) {
        this.index = Long.isLong(resultSetIndex) ? (resultSetIndex as Long).toInt() : (resultSetIndex as number);
        this.columns = _columns;
        this.rows = this._rowsIterator[Symbol.asyncIterator]();
    }
}
