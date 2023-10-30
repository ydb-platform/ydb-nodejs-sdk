import { Ydb } from 'ydb-sdk-proto';

export class TableIndex implements Ydb.Table.ITableIndex {
    public indexColumns: string[] = [];
    public dataColumns: string[] | null = null;
    public globalIndex: Ydb.Table.IGlobalIndex | null = null;
    public globalAsyncIndex: Ydb.Table.IGlobalAsyncIndex | null = null;

    constructor(public name: string) {}

    withIndexColumns(...indexColumns: string[]) {
        this.indexColumns.push(...indexColumns);

        return this;
    }

    /** Adds [covering index](https://ydb.tech/en/docs/concepts/secondary_indexes#covering) over columns */
    withDataColumns(...dataColumns: string[]) {
        if (!this.dataColumns) this.dataColumns = [];
        this.dataColumns?.push(...dataColumns);

        return this;
    }

    withGlobalAsync(isAsync: boolean) {
        if (isAsync) {
            this.globalAsyncIndex = new Ydb.Table.GlobalAsyncIndex();
            this.globalIndex = null;
        } else {
            this.globalAsyncIndex = null;
            this.globalIndex = new Ydb.Table.GlobalIndex();
        }

        return this;
    }
}
