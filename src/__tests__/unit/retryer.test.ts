import {Logger} from "../../logger/simple-logger";
import {buildTestLogger} from "../../logger/tests/test-logger";
import {FakeTimersFixture} from "../../utils/test/fake-timers-fixture";
import {RetryLambdaResult, RetryStrategy} from "../../retries/retryStrategy";
import {BackoffSettings, RetryParameters} from "../../retries/retryParameters";
import {Context} from "../../context";
import {
    fastBackoffRetryMessage,
    immediateBackoffRetryMessage,
    notRetryableErrorMessage,
    slowBackoffRetryMessage,
    successAfterNAttempts
} from "../../retries/message";
import {RetryPolicySymbol} from "../../retries/symbols";
import {Backoff} from "../../errors";
import Mock = jest.Mock;

const RANDOM = 0.7;

describe('retryer', () => {
    const fakeTimersFixture = new FakeTimersFixture();

    // @ts-ignore
    let testLogger: Logger;
    // @ts-ignore
    let testLoggerFn: jest.Mock;

    let notFakeSetTimeout: typeof setTimeout;

    beforeEach(async () => {
        ({testLogger, testLoggerFn} = buildTestLogger());
        notFakeSetTimeout = setTimeout;
        fakeTimersFixture.setup();
        jest.spyOn(Math, 'random');
        (Math.random as Mock).mockReturnValue(RANDOM);
    });

    afterEach(async () => {
        await fakeTimersFixture.dispose();
        jest.restoreAllMocks();
    });

    it('ok', async () => {
        const {ctx} = Context.createNew();
        await expect(
            new RetryStrategy(new RetryParameters(), testLogger)
                .retry(ctx, async (): Promise<RetryLambdaResult<number>> => {
                    return {result: 12};
                })
        ).resolves.toBe(12);
        expect(testLoggerFn.mock.calls).toEqual([
            [
                'debug',
                successAfterNAttempts,
                1,
            ],
        ]);
        // gives up time in the event loop to perform a next retryer step
        await new Promise((resolve) => {
            notFakeSetTimeout(resolve, 0);
        });
    });

    for (const simpleError of [
        true /* throw error, like error in the code */,
        false /* error comes thru RetryLambdaResult */
    ])
        it(`simple error: simpleError: ${Number(simpleError)}`, async () => { // any error without retry policy
            const {ctx} = Context.createNew();
            await expect(
                new RetryStrategy(new RetryParameters(), testLogger)
                    .retry(ctx, async (): Promise<RetryLambdaResult<number>> => {
                        if (simpleError)
                            throw new Error('test');
                        else
                            return {err: new Error('test')};
                    })
            ).rejects.toThrow('test');
            expect(testLoggerFn.mock.calls).toEqual([
                [
                    'debug',
                    notRetryableErrorMessage,
                    new Error('test'),
                ],
            ]);
        });

    const ONLY_TEST = '';

    const MAX_ATTEMPTS = 4;
    const testRetryParameters = new RetryParameters({
        timeout: 10_000,
    });
    // assigned this way, since it's not possible thru constructor
    const FAST_BACKOFF = (testRetryParameters as any).fastBackoff = new BackoffSettings(2, 5);
    const SLOW_BACKOFF = (testRetryParameters as any).slowBackoff = new BackoffSettings(2, 100);

    for (const backoff of [null /* no retry policy at all */, Backoff.No, Backoff.Fast, Backoff.Slow])
        for (const nonIdempotent of [false, true])
            for (const idempotent of [false, true])
                for (const simpleError of [
                    undefined /* operation succeeded */,
                    true /* throw error, like error in the code */,
                    false /* error comes thru RetryLambdaResult */
                ])
                    for (const isIdempotentOp of [false, true]) {
                        // when backoff is not specified, nonIdempotent && idempotent do not affect the test
                        if (backoff === null && !(nonIdempotent && idempotent)) continue;
                        // makes no sense to retry non-idempotent operations, while do not retry idempotent one
                        if (nonIdempotent && !idempotent) continue;
                        // with simply thrown error, the information that operation is idempotent or not is not available
                        if (simpleError && isIdempotentOp) continue;

                        const testName = `retry: ` +
                            `backoff: ${backoff === null ? null : ['No', 'Fast', 'Slow'][backoff]}; ` +
                            `nonIdempotent: ${Number(nonIdempotent)}; idempotent: ${Number(idempotent)}; ` +
                            `simpleError: ${simpleError}; isIdempotentOp: ${Number(isIdempotentOp)}`;
                        // leave the only test, if specified
                        if (ONLY_TEST && testName !== ONLY_TEST) continue;

                        it(testName, async () => {
                            const {ctx} = Context.createNew();
                            // @ts-ignore
                            let res: number, err: any, attemptsCount = 1;
                            /* Note: has .then() at the end */
                            const awaitRes = new RetryStrategy(testRetryParameters, testLogger)
                                .retry(ctx, async () => {
                                    const err = new Error('test');
                                    if (backoff !== null)
                                        (err as any)[RetryPolicySymbol] = {
                                            backoff,
                                            nonIdempotent,
                                            idempotent,
                                        }
                                    if (simpleError === undefined) { // success after errors
                                        if (attemptsCount + 1 === MAX_ATTEMPTS) {
                                            return {result: 12};
                                        } else { // before success result should preceed few errors
                                            return {err, idempotent: isIdempotentOp};
                                        }
                                    } else { // only error
                                        if (simpleError) {
                                            throw err;
                                        } else {
                                            return {err, idempotent: isIdempotentOp};
                                        }
                                    }
                                })
                                .catch((_err) => {
                                    err = _err;
                                });
                            // run retries with fake timer till the end successful or MAX_ATTEMPTS
                            let logLineNumber = 0;
                            main: while (true) {
                                // gives up time in the event loop to perform a next retryer step
                                await new Promise((resolve) => {
                                    notFakeSetTimeout(resolve, 0);
                                });
                                // read rest of the log
                                readLog: for (; logLineNumber < testLoggerFn.mock.calls.length;) {
                                    const logLine = testLoggerFn.mock.calls[logLineNumber++];
                                    if (logLine?.[0] !== 'debug') continue; // skip
                                    switch (logLine[1]) {
                                        case immediateBackoffRetryMessage:
                                        case fastBackoffRetryMessage:
                                        case slowBackoffRetryMessage:
                                            await fakeTimersFixture.advanceTimer(logLine[3]);
                                            // stop reading the log by count of attempts
                                            if (++attemptsCount === MAX_ATTEMPTS) break main;
                                            break readLog;
                                        case notRetryableErrorMessage:
                                        case successAfterNAttempts:
                                            break main;
                                    }
                                }
                            }
                            let expectedLog = [];
                            if (backoff === null || (isIdempotentOp ? !idempotent : !nonIdempotent)) {
                                expectedLog.push([
                                    'debug',
                                    notRetryableErrorMessage,
                                    new Error('test'),
                                ]);
                            } else {
                                switch (backoff) {
                                    case Backoff.No: {
                                        for (let i = 0; i < (simpleError === undefined ? (MAX_ATTEMPTS - 1) : MAX_ATTEMPTS); i++) {
                                            expectedLog.push([
                                                'debug',
                                                immediateBackoffRetryMessage,
                                                new Error('test'),
                                                1,
                                            ]);
                                        }
                                        break;
                                    }
                                    case Backoff.Fast: {
                                        for (let i = 0; i < (simpleError === undefined ? (MAX_ATTEMPTS - 1) : MAX_ATTEMPTS); i++) {
                                            expectedLog.push([
                                                'debug',
                                                fastBackoffRetryMessage,
                                                new Error('test'),
                                                FAST_BACKOFF.calcBackoffTimeout(i),
                                            ]);
                                        }
                                        break;
                                    }
                                    case Backoff.Slow: {
                                        for (let i = 0; i < (simpleError === undefined ? (MAX_ATTEMPTS - 1) : MAX_ATTEMPTS); i++) {
                                            expectedLog.push([
                                                'debug',
                                                slowBackoffRetryMessage,
                                                new Error('test'),
                                                SLOW_BACKOFF.calcBackoffTimeout(i),
                                            ]);
                                        }
                                        break;
                                    }
                                }
                            }
                            if (backoff !== null && simpleError === undefined && (isIdempotentOp ? idempotent : nonIdempotent)) {
                                expect(await awaitRes).toBe(12);
                                expectedLog.push([
                                    'debug',
                                    successAfterNAttempts,
                                    MAX_ATTEMPTS,
                                ]);
                            }
                            expect(testLoggerFn.mock.calls).toEqual(expectedLog);
                        });
                    }

// it('drop counter on another error', async () => {
//
// });
// it('stop on context cancel', async () => {
//
// });
// it('stop on context timeout', async () => {
//
// });
// it('stop on context done', async () => {
//
// });
// it('limit by count for legacy', async () => {
//
// });
})
