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
} from '../../retries/errors';
import {Logger} from '../../logger/simple-logger';
import {retryable} from '../../retries/retries';
import {Endpoint} from "../../discovery";
import {pessimizable} from "../../utils";
import {initDriver, destroyDriver} from "../../utils/test";
import {HasLogger} from "../../logger/has-logger";
import {buildTestLogger} from "../../logger/tests/test-logger";
import {RetryParameters} from "../../retries/retryParameters";

class ErrorThrower implements HasLogger {
    constructor(public endpoint: Endpoint, public readonly logger: Logger) {}

    @retryable(
        new RetryParameters({maxRetries: 3, backoffCeiling: 3, backoffSlotDuration: 5})
    )
    @pessimizable
    errorThrower(callback: () => any) {
        return callback();
    }
}

describe('Retries on errors', () => {
    let driver: Driver;
    // @ts-ignore
    let logger: Logger;
    // @ts-ignore
    let loggerFn: jest.Mock<any, any>;

    beforeAll(async () => {
        driver = await initDriver({logger});
        ({testLogger: logger, testLoggerFn: loggerFn} = buildTestLogger());
    });

    afterAll(async () => await destroyDriver(driver));

    /** Run session with error. retries_need can be  omitted if retries must not occur */
    function createError(error: typeof YdbError, retries_need: number = 1) {
        it(`${error.name}`, async () => {
            // here must be retries
            let retries = 0;
            const et = new ErrorThrower(new Endpoint({}, ''), logger);

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
    // TODO: Add EXTERNAL ERROR
});
