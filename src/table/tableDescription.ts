import { Ydb } from 'ydb-sdk-proto';
import { TtlSettings } from './settings';
import { Column } from './ydb';

import FeatureFlag = Ydb.FeatureFlag.Status;
import { TableIndex } from './tableIndex';
import { TableProfile } from './tableProfile';

export class TableDescription implements Ydb.Table.ICreateTableRequest {
    /** @deprecated use TableDescription options instead */
    public profile?: TableProfile;
    public indexes: TableIndex[] = [];
    public ttlSettings?: TtlSettings;
    public partitioningSettings?: Ydb.Table.IPartitioningSettings;
    public uniformPartitions?: number;
    public columnFamilies?: Ydb.Table.IColumnFamily[];
    public attributes?: { [k: string]: string };
    public compactionPolicy?: 'default' | 'small_table' | 'log_table';
    public keyBloomFilter?: FeatureFlag;
    public partitionAtKeys?: Ydb.Table.IExplicitPartitions;
    public readReplicasSettings?: Ydb.Table.IReadReplicasSettings;
    public storageSettings?: Ydb.Table.IStorageSettings;
    // path and operationPrams defined in createTable,
    // columns and primaryKey are in constructor

    constructor(public columns: Column[] = [], public primaryKey: string[] = []) {}

    withColumn(column: Column) {
        this.columns.push(column);

        return this;
    }

    withColumns(...columns: Column[]) {
        for (const column of columns) {
            this.columns.push(column);
        }

        return this;
    }

    withPrimaryKey(key: string) {
        this.primaryKey.push(key);

        return this;
    }

    withPrimaryKeys(...keys: string[]) {
        for (const key of keys) {
            this.primaryKey.push(key);
        }

        return this;
    }

    /** @deprecated use TableDescription options instead */
    withProfile(profile: TableProfile) {
        this.profile = profile;

        return this;
    }

    withIndex(index: TableIndex) {
        this.indexes.push(index);

        return this;
    }

    withIndexes(...indexes: TableIndex[]) {
        for (const index of indexes) {
            this.indexes.push(index);
        }

        return this;
    }

    withTtl(columnName: string, expireAfterSeconds = 0) {
        this.ttlSettings = new TtlSettings(columnName, expireAfterSeconds);

        return this;
    }

    withPartitioningSettings(partitioningSettings: Ydb.Table.IPartitioningSettings) {
        this.partitioningSettings = partitioningSettings;
    }
}
