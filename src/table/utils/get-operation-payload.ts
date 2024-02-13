import {TableAsyncResponse} from "./table-async-response";
import {MissingOperation, MissingValue, YdbError} from "../../errors";

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
