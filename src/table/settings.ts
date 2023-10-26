import {google, Ydb} from "ydb-sdk-proto";
import * as grpc from "@grpc/grpc-js";

import ITypedValue = Ydb.ITypedValue;
import IKeyRange = Ydb.Table.IKeyRange;
import OperationMode = Ydb.Operations.OperationParams.OperationMode;

export class OperationParams implements Ydb.Operations.IOperationParams {
    operationMode?: OperationMode;
    operationTimeout?: google.protobuf.IDuration;
    cancelAfter?: google.protobuf.IDuration;
    labels?: { [k: string]: string };
    reportCostInfo?: Ydb.FeatureFlag.Status;

    withSyncMode() {
        this.operationMode = OperationMode.SYNC;
        return this;
    }

    withAsyncMode() {
        this.operationMode = OperationMode.ASYNC;
        return this;
    }

    withOperationTimeout(duration: google.protobuf.IDuration) {
        this.operationTimeout = duration;
        return this;
    }

    withOperationTimeoutSeconds(seconds: number) {
        this.operationTimeout = {seconds};
        return this;
    }

    withCancelAfter(duration: google.protobuf.IDuration) {
        this.cancelAfter = duration;
        return this;
    }

    withCancelAfterSeconds(seconds: number) {
        this.cancelAfter = {seconds};
        return this;
    }

    withLabels(labels: {[k: string]: string}) {
        this.labels = labels;
        return this;
    }

    withReportCostInfo() {
        this.reportCostInfo = Ydb.FeatureFlag.Status.ENABLED;
        return this;
    }
}

export class OperationParamsSettings {
    operationParams?: OperationParams;

    withOperationParams(operationParams: OperationParams) {
        this.operationParams = operationParams;
        return this;
    }
}

export class CreateTableSettings extends OperationParamsSettings {
}

export class AlterTableSettings extends OperationParamsSettings {
}

interface IDropTableSettings {
    muteNonExistingTableErrors: boolean;
}
export class DropTableSettings extends OperationParamsSettings {
    muteNonExistingTableErrors: boolean;

    constructor({muteNonExistingTableErrors = true} = {} as IDropTableSettings) {
        super();
        this.muteNonExistingTableErrors = muteNonExistingTableErrors;
    }
}

export class DescribeTableSettings extends OperationParamsSettings {
    includeShardKeyBounds?: boolean;
    includeTableStats?: boolean;
    includePartitionStats?: boolean;

    withIncludeShardKeyBounds(includeShardKeyBounds: boolean) {
        this.includeShardKeyBounds = includeShardKeyBounds;
        return this;
    }

    withIncludeTableStats(includeTableStats: boolean) {
        this.includeTableStats = includeTableStats;
        return this;
    }

    withIncludePartitionStats(includePartitionStats: boolean) {
        this.includePartitionStats = includePartitionStats;
        return this;
    }
}

export class BeginTransactionSettings extends OperationParamsSettings {
}

export class CommitTransactionSettings extends OperationParamsSettings {
    collectStats?: Ydb.Table.QueryStatsCollection.Mode;

    withCollectStats(collectStats: Ydb.Table.QueryStatsCollection.Mode) {
        this.collectStats = collectStats;
        return this;
    }
}

export class RollbackTransactionSettings extends OperationParamsSettings {
}

export class PrepareQuerySettings extends OperationParamsSettings {
}

export class ExecuteQuerySettings extends OperationParamsSettings {
    keepInCache: boolean = false;
    collectStats?: Ydb.Table.QueryStatsCollection.Mode;
    onResponseMetadata?: (metadata: grpc.Metadata) => void;

    withKeepInCache(keepInCache: boolean) {
        this.keepInCache = keepInCache;
        return this;
    }

    withCollectStats(collectStats: Ydb.Table.QueryStatsCollection.Mode) {
        this.collectStats = collectStats;
        return this;
    }
}

export class BulkUpsertSettings extends OperationParamsSettings {
}

export class ReadTableSettings {
    columns?: string[];
    ordered?: boolean;
    rowLimit?: number;
    keyRange?: Ydb.Table.IKeyRange;

    withRowLimit(rowLimit: number) {
        this.rowLimit = rowLimit;
        return this;
    }

    withColumns(...columns: string[]) {
        this.columns = columns;
        return this;
    }

    withOrdered(ordered: boolean) {
        this.ordered = ordered;
        return this;
    }

    withKeyRange(keyRange: IKeyRange) {
        this.keyRange = keyRange;
        return this;
    }

    withKeyGreater(value: ITypedValue) {
        this.getOrInitKeyRange().greater = value;
        return this;
    }

    withKeyGreaterOrEqual(value: ITypedValue) {
        this.getOrInitKeyRange().greaterOrEqual = value;
        return this;
    }

    withKeyLess(value: ITypedValue) {
        this.getOrInitKeyRange().less = value;
        return this;
    }

    withKeyLessOrEqual(value: ITypedValue) {
        this.getOrInitKeyRange().lessOrEqual = value;
        return this;
    }

    private getOrInitKeyRange() {
        if (!this.keyRange) {
            this.keyRange = {};
        }
        return this.keyRange;
    }
}

export class ExecuteScanQuerySettings {
    mode?: Ydb.Table.ExecuteScanQueryRequest.Mode;
    collectStats?: Ydb.Table.QueryStatsCollection.Mode;

    withMode(mode: Ydb.Table.ExecuteScanQueryRequest.Mode) {
        this.mode = mode;
        return this;
    }

    withCollectStats(collectStats: Ydb.Table.QueryStatsCollection.Mode) {
        this.collectStats = collectStats;
        return this;
    }
}

export class TtlSettings implements Ydb.Table.ITtlSettings {
    public dateTypeColumn?: Ydb.Table.IDateTypeColumnModeSettings | null;
    constructor(columnName: string, expireAfterSeconds: number = 0) {
        this.dateTypeColumn = { columnName, expireAfterSeconds };
    }
}
