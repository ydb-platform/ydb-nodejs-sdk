import {TableAsyncResponse} from "./table-async-response";
import {MissingValue, StatusCode} from "../../errors";
import {getOperationPayload} from "./get-operation-payload";

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
