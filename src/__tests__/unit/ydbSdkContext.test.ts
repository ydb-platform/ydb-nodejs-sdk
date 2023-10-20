import {YdbSdkContext} from '../../ydbSdkContext';
import Driver from "./../../driver";
import {buildTestLogger} from "../../utils/tests/test-logger";

describe('ydbSdkConext', () => {

    it('getSafe', async () => {
        const {testLogger, testLoggerFn} = buildTestLogger()
        const driver = {
            logger: testLogger,
        } as Driver;
        const ctx1 = YdbSdkContext.getSafe(driver, 'method1');
        await ctx1.do(() => {
            const ctx2 = YdbSdkContext.getSafe(driver, 'method2');
            expect(ctx2).toBe(ctx1);
        });
        expect(testLoggerFn.mock.calls).toEqual([['trace', 'method1'], ['trace', 'method2']]);
    });

    it('get - ok', async () => {
        const {testLogger, testLoggerFn} = buildTestLogger()
        const driver = {
            logger: testLogger,
        } as Driver;
        const ctx1 = YdbSdkContext.getSafe(driver,'method1');
        await ctx1.do(() => {
            const ctx2 = YdbSdkContext.get('method2');
            expect(ctx2).toBe(ctx1);
        });
        expect(testLoggerFn.mock.calls).toEqual([['trace', 'method1'], ['trace', 'method2']]);
    });

    it('get - ok', async () => {
        expect(() => YdbSdkContext.get('method')).toThrow();
    });
});
