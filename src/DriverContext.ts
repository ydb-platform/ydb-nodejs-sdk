import {Context, getContext, NOT_A_CONTEXT} from "./utils/context";
import Driver from "./driver";
import {getLoggerFromObject} from "./utils/getLoggerFromObject";
import {Logger} from "./utils/simple-logger";

/**
 * Context with reference to the head object - driver.
 */
export class DriverContext extends Context {

    readonly logger: Logger;

    private constructor(context: Context, readonly driver: Driver) {
        super(context);

        this.logger = getLoggerFromObject(this.driver);
    }


    /**
     * This method should be called in methods that can be called by a client code - if this type of context
     * does not already exist, it will be created.  It is important to have access to Driver object to build new context.
     */
    static getSafe(driver: Driver, methodName: string) {
        const ctx = getContext();

        if (!(driver instanceof Driver)) {
            throw Error('Not the Driver! Probably the object does not have such field');
        }

        let context = ctx.findContextByClass<DriverContext>(DriverContext);

        if (context === NOT_A_CONTEXT) {
            context = new DriverContext(ctx, driver);
        }

        context.trace(methodName);

        return context;
    }

    /**
     * Returns the context of this type.  If there is no such context - throws an error.
     */
    static get(methodName: string) {
        const ctx = getContext();

        let context = ctx.findContextByClass<DriverContext>(DriverContext);

        if (context === NOT_A_CONTEXT) {
            throw new Error('RiverContext is not in the context chain. Consider using RiverContext.getSafe()')
        }

        context.trace(methodName);

        return context;
    }

    /**
     * Writes trace to logger and creates span if tracing is enabled.
     */
    private trace(methodName: string) {
        this.driver.logger.trace(methodName);
        // TODO: name span
    }
}
