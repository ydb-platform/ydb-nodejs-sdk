import {SimpleLogger} from "./simple-logger";

let defaultLogger: SimpleLogger;

export function getDefaultLogger() {
    return (defaultLogger || (defaultLogger = new SimpleLogger({envKey: 'YDB_SDK_LOGLEVEL'})));
}
