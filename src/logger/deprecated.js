"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFallbackLogFunction = exports.FallbackLogger = exports.setDefaultLogger = exports.getLogger = exports.setupLogger = void 0;
var get_default_logger_1 = require("./get-default-logger");
/**
 * @deprecated
 * After refactoring the only logger that is in use, is the logger passed in object creation settings of Driver.  As
 * fallback logger there use SimpleLogger.
 */
var setupLogger = function (_) {
    // nothing
};
exports.setupLogger = setupLogger;
/**
 * @deprecated
 * After refactoring the only logger that is in use, is the logger passed in object creation settings of Driver.  As
 * fallback logger there use SimpleLogger.
 */
var getLogger = function () {
    return (0, get_default_logger_1.getDefaultLogger)();
};
exports.getLogger = getLogger;
/**
 * @deprecated
 * After refactoring the only logger that is in use, is the logger passed in object creation settings of Driver.  As
 * fallback logger there use SimpleLogger.
 */
var setDefaultLogger = function () {
    // nothing
};
exports.setDefaultLogger = setDefaultLogger;
/**
 * @deprecated
 * After refactoring the only logger that is in use, is the logger passed in object creation settings of Driver.  As
 * fallback logger there use SimpleLogger.
 */
var FallbackLogger = function () {
    // nothing
};
exports.FallbackLogger = FallbackLogger;
/**
 * @deprecated
 * After refactoring the only logger that is in use, is the logger passed in object creation settings of Driver.  As
 * fallback logger there use SimpleLogger.
 */
var getFallbackLogFunction = function () {
    // nothing
};
exports.getFallbackLogFunction = getFallbackLogFunction;
