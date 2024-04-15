import {Ydb} from "ydb-sdk-proto";
import {MissingOperation, MissingValue, StatusCode, YdbError} from "../retries/errors";

export interface YdbOperationAsyncResponse {
    operation?: Ydb.Operations.IOperation | null
}

export function getOperationPayload(response: YdbOperationAsyncResponse): Uint8Array {
    const {operation} = response;

    if (operation) {
        YdbError.checkStatus(operation);
        const value = operation?.result?.value;
        if (!value) {
            throw new MissingValue('Missing operation result value!');
        }
        return value;
    } else {
        throw new MissingOperation('No operation in response!');
    }
}

export function ensureOperationSucceeded(response: YdbOperationAsyncResponse, suppressedErrors: StatusCode[] = []): void {
    try {
        getOperationPayload(response);
    } catch (error) {
        const e = error as any;
        if (suppressedErrors.indexOf(e.constructor.status) > -1) {
            return;
        }

        if (!(e instanceof MissingValue)) {
            throw e;
        }
    }
}

export interface YdbCallAsyncResponse {
    status?: (Ydb.StatusIds.StatusCode|null);
    issues?: (Ydb.Issue.IIssueMessage[]|null);
}

export function ensureCallSucceeded<T extends YdbCallAsyncResponse>(response: T, suppressedErrors: StatusCode[] = []): T {
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

