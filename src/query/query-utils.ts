import {MissingValue, StatusCode, YdbError} from "../errors";
import {Ydb} from "ydb-sdk-proto";

export interface QueryAsyncResponse {
    status: Ydb.StatusIds.StatusCode;
    issues: Ydb.Issue.IIssueMessage[];
}

export function ensureOperationSucceeded<T extends QueryAsyncResponse>(response: T, suppressedErrors: StatusCode[] = []): T {
    try {
        YdbError.checkStatus(response);
    } catch (error) {
        const e = error as any;
        if (!(suppressedErrors.indexOf(e.constructor.status) > -1 || e instanceof MissingValue)) {
            throw e;
        }
    }
    return response;
}
