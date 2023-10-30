import { Endpoint } from '../../discovery';
import Driver from '../../driver';
import {
    Aborted,
    BadRequest,
    BadSession,
    ClientDeadlineExceeded,
    ClientResourceExhausted,
    GenericError,
    InternalError,
    Overloaded,
    PreconditionFailed,
    SchemeError,
    Timeout,
    TransportUnavailable,
    Unauthenticated,
    Unauthorized,
    Unavailable,
    Undetermined,
    YdbError,
} from '../../errors';
import { LogLevel, SimpleLogger } from '../../utils/simple-logger';
import { retryable, RetryParameters } from '../../retries';
import { destroyDriver, initDriver } from '../../utils/tests/test-utils';

import { pessimizable } from '../../utils/pessimizable';

const logger = new SimpleLogger({ level: LogLevel.error });

class ErrorThrower {
    constructor(public endpoint: Endpoint) {}

    @retryable(
        new RetryParameters({ maxRetries: 3, backoffCeiling: 3, backoffSlotDuration: 5 }),
        logger,
    )
    @pessimizable
    errorThrower(callback: () => any) {
        return callback();
    }
}

describe('Retries on errors', () => {
    let driver: Driver;

    beforeAll(async () => {
        driver = await initDriver({ logger });
    });

    afterAll(async () => destroyDriver(driver));

    /** Run session with error. retries_need can be  omitted if retries must not occur */
    const createError = (error: typeof YdbError, retries_need = 1) => {
        it(`${error.name}`, async () => {
            // here must be retries
            let retries = 0;
            const et = new ErrorThrower(new Endpoint({}, ''));

            await expect(
                driver.tableClient.withSession(async () => {
                    await et.errorThrower(() => {
                        retries++;
                        throw new error('');
                    });
                }),
            ).rejects.toThrow(error);
            expect(retries).toBe(retries_need);
        });
    };

    createError(BadRequest);
    createError(InternalError);
    createError(Aborted, 3); // have retries
    createError(Unauthenticated);
    createError(Unauthorized);
    createError(Unavailable, 3); // have retries
    createError(Undetermined); // TODO: have retries for idempotent queries
    createError(Overloaded, 3); // have retries
    createError(SchemeError);
    createError(GenericError);
    createError(Timeout); // TODO: have retries for idempotent queries
    createError(BadSession); // WHY?
    createError(PreconditionFailed);
    // Transport/Client errors
    createError(TransportUnavailable, 3); // TODO: have retries for idempotent queries, BUT now always have retries
    createError(ClientResourceExhausted, 3);
    createError(ClientDeadlineExceeded, 3);
});
