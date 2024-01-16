import {Context, getContext, NOT_A_CONTEXT} from './utils2/context';
import {Logger, SimpleLogger} from './utils2/simple-logger';

let testModeWarnCB: () => void;
let defaultLogger: Logger;

export const setTestModeWarnCB = (v: () => void) => { testModeWarnCB = v; };

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
    static get(traceName: string, loggerOrObject?: Logger | any) {
        const ctx = getContext();

        let context = ctx.findContextByClass<ContextWithLogger>(ContextWithLogger);

        if (context === NOT_A_CONTEXT) {
            let logger;

            if (loggerOrObject) {
                if (typeof loggerOrObject.info === 'function') { // it's logger itself
                    logger = loggerOrObject;
                } else if (
                    typeof loggerOrObject.logger === 'object'
                    && loggerOrObject.logger !== null
                    && 'error' in loggerOrObject.logger) { // it's an object with property logger with logger in it
                    logger = loggerOrObject.logger as Logger;
                }
            }

            if (!logger) {
                logger = defaultLogger ?? (defaultLogger = new SimpleLogger());
                if (testModeWarnCB) {
                    testModeWarnCB();
                } else {
                    logger.warn((new Error('Missing logger:')).stack!.slice('Error: '.length));
                }
            }

            context = new ContextWithLogger(ctx, logger);
        }

        context.trace(traceName);

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
