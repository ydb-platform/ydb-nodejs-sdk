if (process.env.TEST_ENVIRONMENT === 'dev') require('dotenv').config();
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
    // ExternalError // TODO: Add test for this error
} from '../../errors';
import {retryable, RetryParameters} from '../../retries_obsoleted';
import {Endpoint} from "../../discovery";
import {pessimizable} from "../../utils";
import {destroyDriver, initDriver} from "../../utils/test";
import {LogLevel, SimpleLogger} from "../../logger/simple-logger";

const MAX_RETRIES = 3;

const logger = new SimpleLogger({level: LogLevel.error});
class ErrorThrower {
    constructor(public endpoint: Endpoint) {}

    @retryable(
        new RetryParameters({maxRetries: MAX_RETRIES, backoffCeiling: 3, backoffSlotDuration: 5}),
        logger,
    )
    @pessimizable
    errorThrower(callback: () => any) {
        return callback();
    }
}

// TODO: Remake for new retry policy - no attempts limit, only optional timeout
describe('Retries on errors', () => {
    let driver: Driver;

    beforeAll(async () => {
        driver = await initDriver({logger});
    });

    afterAll(async () => await destroyDriver(driver));

    /** Run session with error. retries_need can be  omitted if retries must not occur */
    function createError(error: typeof YdbError, retries_need: number = 1) {
        it(`${error.name}`, async () => {
            // here must be retries
            let retries = 0;
            const et = new ErrorThrower(new Endpoint({}, ''));

            await expect(
                // TODO: Turn to unit test
                driver.tableClient.withSession(async () => {
                    await et.errorThrower(() => {
                        retries++;
                        throw new error('');
                    });
                }),
            ).rejects.toThrow(error);
            expect(retries).toBe(retries_need);
        });
    }

    createError(BadRequest);
    createError(InternalError);
    createError(Aborted, MAX_RETRIES); // have retries
    createError(Unauthenticated);
    createError(Unauthorized);
    createError(Unavailable, MAX_RETRIES); // have retries
    createError(Undetermined); // TODO: have retries for idempotent queries
    // createError(ExternalError); // TODO: have retries for idempotent queries
    createError(Overloaded, MAX_RETRIES); // have retries
    createError(SchemeError);
    createError(GenericError);
    createError(Timeout); // TODO: have retries for idempotent queries
    createError(BadSession); // WHY?
    createError(PreconditionFailed);
    // Transport/Client errors
    createError(TransportUnavailable, MAX_RETRIES); // TODO: have retries for idempotent queries, BUT now always have retries
    createError(ClientResourceExhausted, MAX_RETRIES);
    createError(ClientDeadlineExceeded, MAX_RETRIES);
    // TODO: Add EXTERNAL ERROR
});
