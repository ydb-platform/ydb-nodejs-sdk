import { LogFn } from '../simple-logger';

export const buildTestLogger = () => {
    const testLoggerFn = jest.fn();
    const testLogger = {
        fatal: testLoggerFn.bind(undefined, 'fatal') as LogFn,
        error: testLoggerFn.bind(undefined, 'error') as LogFn,
        warn: testLoggerFn.bind(undefined, 'warn') as LogFn,
        info: testLoggerFn.bind(undefined, 'info') as LogFn,
        debug: testLoggerFn.bind(undefined, 'debug') as LogFn,
        trace: testLoggerFn.bind(undefined, 'trace') as LogFn,
    };

    return { testLogger, testLoggerFn };
};
