import {Context} from "./Context";


export interface HasObjectContext {
    /**
     * The context in which the object was created. Useful for tracking object initialization and background operations.
     * During dispose/destroy operation it is useful to log the current context and the context in which the object was created.
     */
    readonly objCtx: Context;
}
