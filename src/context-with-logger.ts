import { Context, getContext, NOT_A_CONTEXT } from './utils2/context';
import { Logger } from './utils2/simple-logger';
import { getLoggerFromObject } from './utils2/get-logger-from-object';

/**
 * Context with reference to the head object - driver.
 */
export class ContextWithLogger extends Context {
    private constructor(context: Context, readonly logger: Logger) {
        super(context);
    }

    /**
     * This method should be called in methods that can be called by a client code - if this type of context
     * does not already exist, it will be created.  It is important to have access to Logger object to build new context.
     */
    static getSafe(methodName: string, loggerOrObject: Logger | any) {
        const ctx = getContext();

        let context = ctx.findContextByClass<ContextWithLogger>(ContextWithLogger);

        if (context === NOT_A_CONTEXT) {
            context = new ContextWithLogger(
                ctx,
                typeof loggerOrObject.error === 'function'
                    ? loggerOrObject
                    : getLoggerFromObject(loggerOrObject),
            );
        }

        context.trace(methodName);

        return context;
    }

    /**
     * Returns the context of this type.  If there is no such context - throws an error.
     */
    static get(methodName: string) {
        const ctx = getContext();

        const context = ctx.findContextByClass<ContextWithLogger>(ContextWithLogger);

        if (context === NOT_A_CONTEXT) {
            throw new Error('ContextWithLogger is not in the context chain. Consider using RiverContext.getSafe()');
        }

        context.trace(methodName);

        return context;
    }

    /**
     * Guarantees error logging if the code is called from a thread other than
     * the main thread, such as setTimeout or setInterval.
     *
     * An error is NOT thrown after logging.  And NO result.
     */
    async doHandleError<T>(callback: () => T): Promise<void> {
        try {
            await super.do(callback);
        } catch (error) {
            this.logger.error(error);
        }
    }

    /**
     * Writes trace to logger and creates span if tracing is enabled.
     */
    private trace(methodName: string) {
        this.logger.trace(methodName, this); // as parameter goes as ontext in the chain

        // TODO: name span

        return this; // may be helpful for the code compaction
    }
}
