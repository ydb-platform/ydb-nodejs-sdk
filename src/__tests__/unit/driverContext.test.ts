import {DriverContext} from '../../DriverContext';
import Driver from "./../../driver";
import {buildTestLogger} from "../../utils/tests/test-logger";

describe('driverConext', () => {

    it('getSafe', async () => {
        const {testLogger, testLoggerFn} = buildTestLogger()

        // Note: This way does not go for unit test - since Driver components  initiates async start
        // const driver = new Driver({
        //     connectionString: 'http://test.com:1111/?database=test',
        //     authService: new AnonymousAuthService(),
        //     logger: testLogger});

        // testLoggerFn.mockReset();

        const driver = Object.create(Driver.prototype) as Driver;
        (driver as any).logger = testLogger;

        const ctx1 = DriverContext.getSafe(driver, 'method1');
        await ctx1.do(() => {
            const ctx2 = DriverContext.getSafe(driver, 'method2');
            expect(ctx2).toBe(ctx1);
        });
        expect(testLoggerFn.mock.calls).toEqual([['trace', 'method1'], ['trace', 'method2']]);
    });

    it('get - ok', async () => {
        const {testLogger, testLoggerFn} = buildTestLogger()

        // Note: This way does not go for unit test - since Driver components  initiates async start
        // const driver = new Driver({
        //     connectionString: 'http://test.com:1111/?database=test',
        //     authService: new AnonymousAuthService(),
        //     logger: testLogger});

        // testLoggerFn.mockReset();

        const driver = Object.create(Driver.prototype) as Driver;
        (driver as any).logger = testLogger;

        const ctx1 = DriverContext.getSafe(driver,'method1');
        await ctx1.do(() => {
            const ctx2 = DriverContext.get('method2');
            expect(ctx2).toBe(ctx1);
        });
        expect(testLoggerFn.mock.calls).toEqual([['trace', 'method1'], ['trace', 'method2']]);
    });

    it('get - error', async () => {
        expect(() => DriverContext.get('method')).toThrow();
    });
});
