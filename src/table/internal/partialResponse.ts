import { Ydb } from 'ydb-sdk-proto';

export interface PartialResponse<T> {
    status?: (Ydb.StatusIds.StatusCode | null);
    issues?: (Ydb.Issue.IIssueMessage[] | null);
    result?: (T | null);
}
