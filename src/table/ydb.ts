import { Ydb } from 'ydb-sdk-proto';

import IType = Ydb.IType;
import AutoPartitioningPolicy = Ydb.Table.PartitioningPolicy.AutoPartitioningPolicy;
import ITypedValue = Ydb.ITypedValue;
import FeatureFlag = Ydb.FeatureFlag.Status;
import Compression = Ydb.Table.ColumnFamilyPolicy.Compression;

export class Column implements Ydb.Table.IColumnMeta {
    constructor(public name: string, public type: IType, public family?: string) {}
}

export class StorageSettings implements Ydb.Table.IStoragePool {
    constructor(public media: string) {}
}

export class ColumnFamilyPolicy implements Ydb.Table.IColumnFamilyPolicy {
    public name?: string;
    public data?: StorageSettings;
    public external?: StorageSettings;
    public keepInMemory?: FeatureFlag;
    public compression?: Compression;

    withName(name: string) {
        this.name = name;

        return this;
    }

    withData(data: StorageSettings) {
        this.data = data;

        return this;
    }

    withExternal(external: StorageSettings) {
        this.external = external;

        return this;
    }

    withKeepInMemory(keepInMemory: FeatureFlag) {
        this.keepInMemory = keepInMemory;

        return this;
    }

    withCompression(compression: Compression) {
        this.compression = compression;

        return this;
    }
}

export class StoragePolicy implements Ydb.Table.IStoragePolicy {
    public presetName?: string;
    public syslog?: StorageSettings;
    public log?: StorageSettings;
    public data?: StorageSettings;
    public external?: StorageSettings;
    public keepInMemory?: FeatureFlag;
    public columnFamilies: ColumnFamilyPolicy[] = [];

    withPresetName(presetName: string) {
        this.presetName = presetName;

        return this;
    }

    withSyslog(syslog: StorageSettings) {
        this.syslog = syslog;

        return this;
    }

    withLog(log: StorageSettings) {
        this.log = log;

        return this;
    }

    withData(data: StorageSettings) {
        this.data = data;

        return this;
    }

    withExternal(external: StorageSettings) {
        this.external = external;

        return this;
    }

    withKeepInMemory(keepInMemory: FeatureFlag) {
        this.keepInMemory = keepInMemory;

        return this;
    }

    withColumnFamilies(...columnFamilies: ColumnFamilyPolicy[]) {
        for (const policy of columnFamilies) {
            this.columnFamilies.push(policy);
        }

        return this;
    }
}

export class ExplicitPartitions implements Ydb.Table.IExplicitPartitions {
    constructor(public splitPoints: ITypedValue[]) {}
}

export class PartitioningPolicy implements Ydb.Table.IPartitioningPolicy {
    public presetName?: string;
    public autoPartitioning?: AutoPartitioningPolicy;
    public uniformPartitions?: number;
    public explicitPartitions?: ExplicitPartitions;

    withPresetName(presetName: string) {
        this.presetName = presetName;

        return this;
    }

    withUniformPartitions(uniformPartitions: number) {
        this.uniformPartitions = uniformPartitions;

        return this;
    }

    withAutoPartitioning(autoPartitioning: AutoPartitioningPolicy) {
        this.autoPartitioning = autoPartitioning;

        return this;
    }

    withExplicitPartitions(explicitPartitions: ExplicitPartitions) {
        this.explicitPartitions = explicitPartitions;

        return this;
    }
}

export class ReplicationPolicy implements Ydb.Table.IReplicationPolicy {
    presetName?: string;
    replicasCount?: number;
    createPerAvailabilityZone?: FeatureFlag;
    allowPromotion?: FeatureFlag;

    withPresetName(presetName: string) {
        this.presetName = presetName;

        return this;
    }

    withReplicasCount(replicasCount: number) {
        this.replicasCount = replicasCount;

        return this;
    }

    withCreatePerAvailabilityZone(createPerAvailabilityZone: FeatureFlag) {
        this.createPerAvailabilityZone = createPerAvailabilityZone;

        return this;
    }

    withAllowPromotion(allowPromotion: FeatureFlag) {
        this.allowPromotion = allowPromotion;

        return this;
    }
}

export class CompactionPolicy implements Ydb.Table.ICompactionPolicy {
    constructor(public presetName: string) {}
}

export class ExecutionPolicy implements Ydb.Table.IExecutionPolicy {
    constructor(public presetName: string) {}
}

export class CachingPolicy implements Ydb.Table.ICachingPolicy {
    constructor(public presetName: string) {}
}
