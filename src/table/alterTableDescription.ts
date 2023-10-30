import { Ydb } from 'ydb-sdk-proto';
import { Column } from './ydb';
import { TableIndex } from './tableIndex';
import { TtlSettings } from './settings';

export class AlterTableDescription {
    public addColumns: Column[] = [];
    public dropColumns: string[] = [];
    public alterColumns: Column[] = [];
    public setTtlSettings?: TtlSettings;
    public dropTtlSettings?: {};
    public addIndexes: TableIndex[] = [];
    public dropIndexes: string[] = [];
    public alterStorageSettings?: Ydb.Table.IStorageSettings;
    public addColumnFamilies?: Ydb.Table.IColumnFamily[];
    public alterColumnFamilies?: Ydb.Table.IColumnFamily[];
    public alterAttributes?: { [k: string]: string };
    public setCompactionPolicy?: string;
    public alterPartitioningSettings?: Ydb.Table.IPartitioningSettings;
    public setKeyBloomFilter?: Ydb.FeatureFlag.Status;
    public setReadReplicasSettings?: Ydb.Table.IReadReplicasSettings;
    public addChangefeeds?: Ydb.Table.IChangefeed[];
    public dropChangefeeds?: string[];
    public renameIndexes?: Ydb.Table.IRenameIndexItem[];

    constructor() {}

    withAddColumn(column: Column) {
        this.addColumns.push(column);

        return this;
    }

    withDropColumn(columnName: string) {
        this.dropColumns.push(columnName);

        return this;
    }

    withAlterColumn(column: Column) {
        this.alterColumns.push(column);

        return this;
    }

    withSetTtl(columnName: string, expireAfterSeconds = 0) {
        this.setTtlSettings = new TtlSettings(columnName, expireAfterSeconds);

        return this;
    }

    withDropTtl() {
        this.dropTtlSettings = {};

        return this;
    }
}
