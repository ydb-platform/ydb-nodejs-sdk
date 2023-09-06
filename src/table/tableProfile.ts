import {Ydb} from "ydb-sdk-proto";
import {
    CachingPolicy,
    CompactionPolicy,
    ExecutionPolicy,
    PartitioningPolicy,
    ReplicationPolicy,
    StoragePolicy
} from "./ydb";

export class TableProfile implements Ydb.Table.ITableProfile {
    public presetName?: string;
    public storagePolicy?: StoragePolicy;
    public compactionPolicy?: CompactionPolicy;
    public partitioningPolicy?: PartitioningPolicy;
    public executionPolicy?: ExecutionPolicy;
    public replicationPolicy?: ReplicationPolicy;
    public cachingPolicy?: CachingPolicy;

    withPresetName(presetName: string) {
        this.presetName = presetName;
        return this;
    }

    withStoragePolicy(storagePolicy: StoragePolicy) {
        this.storagePolicy = storagePolicy;
        return this;
    }

    withCompactionPolicy(compactionPolicy: CompactionPolicy) {
        this.compactionPolicy = compactionPolicy;
        return this;
    }

    withPartitioningPolicy(partitioningPolicy: PartitioningPolicy) {
        this.partitioningPolicy = partitioningPolicy;
        return this;
    }

    withExecutionPolicy(executionPolicy: ExecutionPolicy) {
        this.executionPolicy = executionPolicy;
        return this;
    }

    withReplicationPolicy(replicationPolicy: ReplicationPolicy) {
        this.replicationPolicy = replicationPolicy;
        return this;
    }

    withCachingPolicy(cachingPolicy: CachingPolicy) {
        this.cachingPolicy = cachingPolicy;
        return this;
    }
}
