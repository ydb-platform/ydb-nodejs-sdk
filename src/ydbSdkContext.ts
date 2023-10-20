import {Context, getContext, NOT_A_CONTEXT} from "./utils/context";
import Driver from "./driver";

/**
 * Context with reference to the head object - driver.
 */
export class YdbSdkContext extends Context {
    private constructor(context: Context, readonly driver: Driver) {
        super(context);
    }

    /**
     * This method should be called in methods that can be called by a client code - if this type of context
     * does not already exist, it will be created.  It is important to have access to Driver object to build new context.
     */
    static getSafe(driver: Driver, methodName: string) {
        const ctx = getContext();

        console.info(2000, ctx)

        let context = ctx.findContextByClass<YdbSdkContext>(YdbSdkContext);

        if (context === NOT_A_CONTEXT) {
            context = new YdbSdkContext(ctx, driver);
        }

        context.trace(methodName);

        return context;
    }

    /**
     * Returns the context of this type.  If there is no such context - throws an error.
     */
    static get(methodName: string) {
        const ctx = getContext();

        let context = ctx.findContextByClass<YdbSdkContext>(YdbSdkContext);

        if (context === NOT_A_CONTEXT) {
            throw new Error('YdbSdkContext is not in the context chain. Consider using YdbSdkContext.getSafe()')
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
