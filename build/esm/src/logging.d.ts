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
/**
 * Sets up logger
 * Use before any usage of YDB-SDK functions. If not used, fallback logger will be used
 */
export declare function setupLogger(logger: Logger): void;
/**
 * @deprecated
 * Use setupLogger instead
 */
export declare function setDefaultLogger(logger: Logger): void;
/** basic fallback implementation of LogFn */
export declare function getFallbackLogFunction(level: string): {
    (msg: string, ...args: any[]): void;
    (obj: unknown, msg?: string | undefined, ...args: any[]): void;
};
export declare class FallbackLogger implements Logger {
    fatal: LogFn;
    error: LogFn;
    warn: LogFn;
    info: LogFn;
    debug: LogFn;
    trace: LogFn;
    constructor(options?: {
        level: string;
    });
}
export declare function getLogger(options?: any): Logger;
