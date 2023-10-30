import { Ydb } from 'ydb-sdk-proto';

export interface AsyncResponse {
    operation?: Ydb.Operations.IOperation | null
}
