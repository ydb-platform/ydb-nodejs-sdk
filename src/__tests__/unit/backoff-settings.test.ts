import * as utils from '../../utils';
import {BackoffSettings} from "../../retries/retryParameters";
function runTest(backoff: BackoffSettings, retries: number, min: number, max: number) {
    it(`have correct value for ${retries} retries`, () => {
        let timeout = -1;
        const spy = jest.spyOn(utils, 'sleep').mockImplementation((val) => {
            timeout = val;
            return Promise.resolve();
        });

        backoff.waitBackoffTimeout(retries);
        expect(spy).toBeCalled();
        expect(timeout).toBeGreaterThanOrEqual(min);
        expect(timeout).toBeLessThanOrEqual(max);
    });
}

describe('Fast backoff', () => {

    const fast = new BackoffSettings(10, 5);

    afterEach(() => {
        // restore the spy created with spyOn
        jest.restoreAllMocks();
    });

    runTest(fast, 0, 2.5, 5);
    runTest(fast, 1, 5, 10);
    runTest(fast, 6, (1 << 6) * 5 * 0.5, (1 << 6) * 5);
    runTest(fast, 10, (1 << 10) * 5 * 0.5, (1 << 10) * 5);
    runTest(fast, 11, (1 << 10) * 5 * 0.5, (1 << 10) * 5);
});

describe('Slow backoff', () => {
    const slow = new BackoffSettings(6, 1000);

    afterEach(() => {
        jest.restoreAllMocks();
    });

    runTest(slow, 0, 500, 1000);
    runTest(slow, 1, 1000, 2000);
    runTest(slow, 2, 2000, 4000);
    runTest(slow, 6, (1 << 6) * 1000 * 0.5, (1 << 6) * 1000);
    runTest(slow, 10, (1 << 6) * 1000 * 0.5, (1 << 6) * 1000);
});
