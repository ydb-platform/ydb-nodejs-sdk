import {Ydb} from "ydb-sdk-proto";

export interface TableAsyncResponse {
    operation?: Ydb.Operations.IOperation | null
}
