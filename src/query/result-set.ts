import {Ydb} from "ydb-sdk-proto";
import {IAsyncQueueIterator} from "../utils/build-async-queue-iterator";
import {RowType} from "./query-session-execute";
import * as symbols from './symbols'
import {convertYdbValueToNative, snakeToCamelCaseConversion, TypedData} from "../types";

export class ResultSet {
    [symbols.resultsetYdbColumnsSymbol]?: Ydb.IColumn[];

    public readonly columns: Ydb.IColumn[] | string[];
    public readonly rows: AsyncGenerator<{[key: string]: any}, void>;

    constructor(
        public readonly index: number,
        columns: Ydb.IColumn[] | string[],
        public readonly rowMode: RowType,
        rowsIterator: IAsyncQueueIterator<{[key: string]: any}> // IValue when rowMode === RowType.Ydb otherwise an object where columns become properties
    ) {
        this.columns = columns;
        this.rows = rowsIterator[Symbol.asyncIterator]();
    }

    public typedRows<T extends TypedData>(type: {new(...args: any[]): T}): AsyncGenerator<T, void> {
        if (this.rowMode !== RowType.Ydb) throw new Error('Typed strings can only be retrieved in rowMode == RowType.Ydb')
        const columns = this.columns as Ydb.IColumn[];
        // TODO: Check correspondence of required and received columns and their types
        async function* typedRows<T>(self: ResultSet) {
            const nativeColumns = columns.map(col => snakeToCamelCaseConversion.ydbToJs(col.name!))
            const rows = self.rows;
            while (true) {
                const {value: ydbRow, done} = await rows.next();
                if (done) return;
                yield ydbRow!.items!.reduce((acc: Record<string, any>, value: Ydb.IValue, index: number) => {
                    acc[nativeColumns[index]] = convertYdbValueToNative(columns[index].type!, value);
                    return acc;
                }, Object.create(type.prototype)) as T;
            }
        }
        return typedRows<T>(this);
    }
}
