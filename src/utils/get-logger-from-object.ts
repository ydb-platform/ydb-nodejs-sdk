import { SimpleLogger, Logger } from './simple-logger';

let defaultLogger: Logger;

/**
 * To take loggers for @retriable in any SDK code, it is convenient to take as convention that
 * the logger field is stored in the logger field in the object where @retriable was applied.
 *
 * This method returns the value of the logger field with a check that there is
 * a logger there, or returns the default logger with the appropriate trace.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getLoggerFromObject = (obj: any) => {
    if (typeof obj.logger === 'object' && obj.logger !== null && 'error' in obj.logger) {
        return obj.logger as Logger;
    }
    if (!defaultLogger) {
        defaultLogger = new SimpleLogger();
    }
    defaultLogger.trace('Missing "logger" field in the object');

    return defaultLogger;
};
