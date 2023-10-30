import { MissingOperation, MissingValue, YdbError } from '../errors';

import { AsyncResponse } from './async-response';

export const getOperationPayload = (response: AsyncResponse): Uint8Array => {
    const { operation } = response;

    if (operation) {
        YdbError.checkStatus(operation);
        const value = operation?.result?.value;

        if (!value) {
            throw new MissingValue('Missing operation result value!');
        }

        return value;
    }
    throw new MissingOperation('No operation in response!');
};
