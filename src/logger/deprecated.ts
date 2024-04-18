import {getDefaultLogger} from "./get-default-logger";
import {Logger} from "./simple-logger";

/**
 * @deprecated
 * After refactoring the only logger that is in use, is the logger passed in object creation settings of Driver.  As
 * fallback logger there use SimpleLogger.
 */
export const setupLogger = (_: Logger) => {
    // nothing
};
/**
 * @deprecated
 * After refactoring the only logger that is in use, is the logger passed in object creation settings of Driver.  As
 * fallback logger there use SimpleLogger.
 */
export const getLogger = () => {
    return getDefaultLogger();
};
/**
 * @deprecated
 * After refactoring the only logger that is in use, is the logger passed in object creation settings of Driver.  As
 * fallback logger there use SimpleLogger.
 */
export const setDefaultLogger = () => {
    // nothing
};
/**
 * @deprecated
 * After refactoring the only logger that is in use, is the logger passed in object creation settings of Driver.  As
 * fallback logger there use SimpleLogger.
 */
export const FallbackLogger = () => {
    // nothing
};
/**
 * @deprecated
 * After refactoring the only logger that is in use, is the logger passed in object creation settings of Driver.  As
 * fallback logger there use SimpleLogger.
 */
export const getFallbackLogFunction = () => {
    // nothing
};
