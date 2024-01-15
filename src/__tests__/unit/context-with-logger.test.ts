import { ContextWithLogger } from '../../context-with-logger';
import Driver from '../../driver';
import { buildTestLogger } from '../../utils2/tests/test-logger';

describe('ContextWithLogger', () => {
    it('get', async () => {
        const { testLogger, testLoggerFn } = buildTestLogger();
        const ctx1 = ContextWithLogger.get('method1', testLogger);

        await ctx1.do(() => {
            const ctx2 = ContextWithLogger.get('method2', testLogger);

            expect(ctx2).toBe(ctx1);
        });
        expect(testLoggerFn.mock.calls).toEqual([['trace', 'method1', ctx1], ['trace', 'method2', ctx1]]);
    });

    it('get - ok', async () => {
        const { testLogger, testLoggerFn } = buildTestLogger();
        const driver = Object.create(Driver.prototype) as Driver;

        (driver as any).logger = testLogger;
        const ctx1 = ContextWithLogger.get('method1', testLogger);

        await ctx1.do(() => {
            const ctx2 = ContextWithLogger.get('method2');

            expect(ctx2).toBe(ctx1);
        });
        expect(testLoggerFn.mock.calls).toEqual([['trace', 'method1', ctx1], ['trace', 'method2', ctx1]]);
    });

    it('get - error', async () => {
        expect(() => ContextWithLogger.get('method')).toThrow();
    });
});
