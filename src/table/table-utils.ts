import {MissingOperation, MissingValue, StatusCode, YdbError} from "../errors";
import {Ydb} from "ydb-sdk-proto";

export interface TableAsyncResponse {
    operation?: Ydb.Operations.IOperation | null
}

export function getOperationPayload(response: TableAsyncResponse): Uint8Array {
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

export function ensureOperationSucceeded(response: TableAsyncResponse, suppressedErrors: StatusCode[] = []): void {
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
