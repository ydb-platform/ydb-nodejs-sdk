import {DEFAULT_ENV_KEY, SimpleLogger} from "./simple-logger";

let defaultLogger: SimpleLogger;

/**
 * Returns a simple logger - logging to the console that takes the logging level from the environment
 * variable YDB_SDK_LOGLEVEL. The default is "info".
 */
export function getDefaultLogger() {
    return (defaultLogger || (defaultLogger = new SimpleLogger({envKey: DEFAULT_ENV_KEY})));
}
