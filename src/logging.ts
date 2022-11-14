import pino, { LogFn, LoggerOptions } from 'pino';

interface Logger {
    fatal: LogFn;
    error: LogFn;
    warn: LogFn;
    info: LogFn;
    debug: LogFn;
    trace: LogFn;
}

const LOGLEVEL = process.env.YDB_SDK_LOGLEVEL || 'info';
const PRETTY_LOGS = Boolean(process.env.YDB_SDK_PRETTY_LOGS);

const defaultLoggerOptions = {
    level: LOGLEVEL,
    prettyPrint: PRETTY_LOGS,
};

let logger: Logger | null = null;

/**
 * Sets the default logger
 */
export function setDefaultLogger(newLogger: Logger) {
    logger = newLogger;
    logger.debug(`Default logger changed to ${newLogger.constructor.name}`);
}

export default function getLogger(options: LoggerOptions = defaultLoggerOptions): Logger {
    if (!logger) {
        logger = pino(options);
    }
    return logger;
}

export { Logger, LogFn };
