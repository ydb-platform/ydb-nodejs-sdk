import { SimpleLogger } from './simple-logger';

export const buildTestLogger = () => {
    const testLoggerFn = jest.fn();
    const testLogger = {
        fatal: testLoggerFn.bind(undefined, 'fatal') as SimpleLogger.LogFn,
        error: testLoggerFn.bind(undefined, 'error') as SimpleLogger.LogFn,
        warn: testLoggerFn.bind(undefined, 'warn') as SimpleLogger.LogFn,
        info: testLoggerFn.bind(undefined, 'info') as SimpleLogger.LogFn,
        debug: testLoggerFn.bind(undefined, 'debug') as SimpleLogger.LogFn,
        trace: testLoggerFn.bind(undefined, 'trace') as SimpleLogger.LogFn,
    };

    return { testLogger, testLoggerFn };
};
