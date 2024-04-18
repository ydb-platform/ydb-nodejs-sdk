import {Logger} from "./simple-logger";

/**
 * The interface grants that the object has a logger property.  It is necessary that decorators can get
 * the logger of the object whose method they are decorating.
 */
export interface HasLogger {
    readonly logger: Logger;
}
