export interface LogFn {
    (obj: unknown, msg?: string, ...args: any[]): void;
    (msg: string, ...args: any[]): void;
}

export interface Logger {
    fatal: LogFn;
    error: LogFn;
    warn: LogFn;
    info: LogFn;
    debug: LogFn;
    trace: LogFn;
}

const LOGLEVEL = process.env.YDB_SDK_LOGLEVEL || 'info';

const defaultLoggerOptions = {
    level: LOGLEVEL,
};

let globalLogger: Logger | null = null;

/**
 * Sets up logger
 * Use before any usage of YDB-SDK functions. If not used, fallback logger will be used
 */
export const setupLogger = (logger: Logger) => {
    if (globalLogger !== null) globalLogger.warn('Reassigning logger, some logs can be lost');
    globalLogger = logger;
    globalLogger.debug(`Default logger changed to ${globalLogger.constructor.name}`);
};
/**
 * @deprecated
 * Use setupLogger instead
 */
export const setDefaultLogger = (logger: Logger) => setupLogger(logger);

/** basic fallback implementation of LogFn */
export const getFallbackLogFunction = (level: string) => {
    // function log(msg: string, ...args: any[]): void;
    // function log(obj: unknown, msg?: string, ...args: any[]): void;
    const log = (obj: string | unknown, ...args: any[]): void => {
        const dateLevel = `[${new Date().toISOString()} ${level.toUpperCase()}]`;

        if (typeof obj === 'object') {
            let objectString: string;

            try {
                objectString = JSON.stringify(obj);
            } catch {
                objectString = String(obj);
            }
            console.log(dateLevel, objectString, ...args);
        } else console.log(dateLevel, obj, ...args);
    };

    return log;
};

export class FallbackLogger implements Logger {
    fatal: LogFn = () => {};
    error: LogFn = () => {};
    warn: LogFn = () => {};
    info: LogFn = () => {};
    debug: LogFn = () => {};
    trace: LogFn = () => {};

    constructor(options = defaultLoggerOptions) {
        // eslint-disable-next-line no-param-reassign
        if (!options.level) options.level = 'info';
        switch (options.level.toLowerCase()) {
            // @ts-ignore no-switch-case-fall-through
            case 'trace': {
                this.trace = getFallbackLogFunction('trace');
            }
            // @ts-ignore
            // eslint-disable-next-line no-fallthrough
            case 'debug': {
                this.debug = getFallbackLogFunction('debug');
            }
            // eslint-disable-next-line default-case-last,no-fallthrough
            default:
            // @ts-ignore
            // eslint-disable-next-line no-fallthrough
            case 'info': {
                this.info = getFallbackLogFunction('info');
            }
            // @ts-ignore
            // eslint-disable-next-line no-fallthrough
            case 'warn': {
                this.warn = getFallbackLogFunction('warn');
            }
            // @ts-ignore
            // eslint-disable-next-line no-fallthrough
            case 'error': {
                this.error = getFallbackLogFunction('error');
            }
            // eslint-disable-next-line no-fallthrough
            case 'fatal': {
                this.fatal = getFallbackLogFunction('fatal');
            }
        }
    }
}

export const getLogger = (options?: any): Logger => {
    if (!globalLogger) {
        globalLogger = new FallbackLogger(options);
        globalLogger.debug('Using fallback logger');
    }

    return globalLogger;
};
