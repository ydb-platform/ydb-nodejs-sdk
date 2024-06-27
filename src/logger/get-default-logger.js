"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultLogger = void 0;
var simple_logger_1 = require("./simple-logger");
var defaultLogger;
/**
 * Returns a simple logger - logging to the console that takes the logging level from the environment
 * variable YDB_SDK_LOGLEVEL. The default is "info".
 */
function getDefaultLogger() {
    return (defaultLogger || (defaultLogger = new simple_logger_1.SimpleLogger({ envKey: simple_logger_1.DEFAULT_ENV_KEY })));
}
exports.getDefaultLogger = getDefaultLogger;
