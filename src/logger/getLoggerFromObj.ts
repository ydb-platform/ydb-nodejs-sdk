import {Logger} from "./simple-logger";
import {getDefaultLogger} from "./getDefaultLogger";

export function getLoggerFromObject(obj: any) {
    if (typeof obj === 'object' && obj !== null) {
        const logger = obj['logger'] as any;
        if (typeof logger === 'object' && logger !== null
            && ['fatal', 'error', 'warn', 'info', 'debug', 'trace'].every((m) => typeof logger[m] === 'function'))
            return logger as Logger;
    }
    return getDefaultLogger();
}
