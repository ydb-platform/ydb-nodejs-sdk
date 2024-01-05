import { MissingValue, StatusCode } from '../errors';
import { getOperationPayload } from './get-operation-payload';
import { AsyncResponse } from './async-response';

export const ensureOperationSucceeded = (response: AsyncResponse, suppressedErrors: StatusCode[] = []): void => {
    try {
        getOperationPayload(response);
    } catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = error as any;

        if (suppressedErrors.includes(e.constructor.status)) {
            return;
        }

        if (!(e instanceof MissingValue)) {
            throw e;
        }
    }
};
