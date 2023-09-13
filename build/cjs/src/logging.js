"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogger = exports.FallbackLogger = exports.getFallbackLogFunction = exports.setDefaultLogger = exports.setupLogger = void 0;
const LOGLEVEL = process.env.YDB_SDK_LOGLEVEL || 'info';
const defaultLoggerOptions = {
    level: LOGLEVEL,
};
let globalLogger = null;
/**
 * Sets up logger
 * Use before any usage of YDB-SDK functions. If not used, fallback logger will be used
 */
function setupLogger(logger) {
    if (globalLogger !== null)
        globalLogger.warn(`Reassigning logger, some logs can be lost`);
    globalLogger = logger;
    globalLogger.debug(`Default logger changed to ${globalLogger.constructor.name}`);
}
exports.setupLogger = setupLogger;
/**
 * @deprecated
 * Use setupLogger instead
 */
function setDefaultLogger(logger) {
    return setupLogger(logger);
}
exports.setDefaultLogger = setDefaultLogger;
/** basic fallback implementation of LogFn */
function getFallbackLogFunction(level) {
    function log(obj, ...args) {
        const dateLevel = `[${new Date().toISOString()} ${level.toUpperCase()}]`;
        if (typeof obj === 'object') {
            let objectString;
            try {
                objectString = JSON.stringify(obj);
            }
            catch (error) {
                objectString = String(obj);
            }
            console.log(dateLevel, objectString, ...args);
        }
        else
            console.log(dateLevel, obj, ...args);
    }
    return log;
}
exports.getFallbackLogFunction = getFallbackLogFunction;
class FallbackLogger {
    constructor(options = defaultLoggerOptions) {
        this.fatal = () => { };
        this.error = () => { };
        this.warn = () => { };
        this.info = () => { };
        this.debug = () => { };
        this.trace = () => { };
        if (!options.level)
            options.level = 'info';
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
exports.FallbackLogger = FallbackLogger;
function getLogger(options) {
    if (!globalLogger) {
        globalLogger = new FallbackLogger(options);
        globalLogger.debug('Using fallback logger');
    }
    return globalLogger;
}
exports.getLogger = getLogger;
