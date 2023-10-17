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
export function setupLogger(logger: Logger) {
    if(globalLogger !== null) globalLogger.warn(`Reassigning logger, some logs can be lost`)
    globalLogger = logger;
    globalLogger.debug(`Default logger changed to ${globalLogger.constructor.name}`);
}
/**
 * @deprecated
 * Use setupLogger instead
 */
export function setDefaultLogger(logger: Logger){
    return setupLogger(logger)
}

/** basic fallback implementation of LogFn */
export function getFallbackLogFunction(level: string) {
    function log(msg: string, ...args: any[]): void;
    function log(obj: unknown, msg?: string, ...args: any[]): void;
    function log(obj: string | unknown, ...args: any[]): void {
        const dateLevel = `[${new Date().toISOString()} ${level.toUpperCase()}]`;

        if (typeof obj === 'object') {
            let objectString: string;
            try {
                objectString = JSON.stringify(obj);
            } catch (error) {
                objectString = String(obj);
            }
            console.log(dateLevel, objectString, ...args);
        } else console.log(dateLevel, obj, ...args);
    }
    return log;
}

export class FallbackLogger implements Logger {
    fatal: LogFn = () => {};
    error: LogFn = () => {};
    warn: LogFn = () => {};
    info: LogFn = () => {};
    debug: LogFn = () => {};
    trace: LogFn = () => {};

    constructor(options = defaultLoggerOptions) {
        if (!options.level) options.level = 'info';
        switch (options.level.toLowerCase()) {
            // @ts-ignore no-switch-case-fall-through
            case 'trace':
                this.trace = getFallbackLogFunction('trace');
            // @ts-ignore
            case 'debug':
                this.debug = getFallbackLogFunction('debug');
            default:
            // @ts-ignore
            case 'info':
                this.info = getFallbackLogFunction('info');
            // @ts-ignore
            case 'warn':
                this.warn = getFallbackLogFunction('warn');
            // @ts-ignore
            case 'error':
                this.error = getFallbackLogFunction('error');
            case 'fatal':
                this.fatal = getFallbackLogFunction('fatal');
        }
    }
}

export function getLogger(options?: any): Logger {
    if (!globalLogger) {
        globalLogger = new FallbackLogger(options);
        globalLogger.debug('Using fallback logger');
    }
    return globalLogger;
}
