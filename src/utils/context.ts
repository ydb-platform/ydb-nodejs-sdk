/**
 * Context object allows to pass a context-chain (number of contexts, linked by "parent" field) thru function calls stack.
 *
 * To do this, you need to call functions like "context.do(() => [some function])".  And in this "some function" at the
 * beginning execute "const context = getContext();".
 *
 * Create a new context - "new Context(context?)".  If context is provided, then new context considers it as a child-context.
 * Otherwise, it's new context with an id, if newId() function was specified.
 *
 * Getting the context fields "... = context...".  Also, context might have methods.
 *
 * Specific part of context-chain can be obtained thru findContextByClass() method.
 */
export class Context {
    readonly id?: any;
    readonly parent?: Context;

    /**
     * A non-required method that is called after the function, and allows you to collect the method
     * run time and close spans for tracing.
     */
    protected done?: (error?: any) => void;

    constructor(parent?: Context) {
        if (parent && parent !== NOT_A_CONTEXT) {
            if (parent.id !== undefined) {
                this.id = parent.id;
            }
            this.parent = parent;
        } else {
            const id = newId();

            if (id !== undefined) {
                this.id = id;
            }
        }
    }

    /**
     * Calls the method passed as a callback with pass in the context from which the method was called.
     *
     * The context can be obtained in the first line of the called function - *const ctx = getContext();*.
     */
    async do<T>(callback: () => T): Promise<T> {
        const prevContext = _context;
        let error: any;

        try {
            _context = this;

            return callback();
        } catch (_error) {
            error = _error;
            throw error;
        } finally {
            _context = prevContext;
            let ctx: Context | undefined = this;

            while (ctx) {
                if (ctx.done) {
                    ctx.done(error);
                }
                ctx = ctx.parent;
            }
        }
    }

    /**
     * Calls the method passed as a callback with pass in the context from which the method was called.
     *
     * The context can be obtained in the first line of the called function - *const ctx = getContext();*.
     *
     * Sync version primarily required to call anything within constructors.
     */
    doSync<T>(callback: () => T): T {
        const prevContext = _context;
        let error: any;

        try {
            _context = this;

            return callback();
        } catch (_error) {
            error = _error;
            throw error;
        } finally {
            _context = prevContext;
            let ctx: Context | undefined = this;

            while (ctx) {
                if (ctx.done) {
                    ctx.done(error);
                }
                ctx = ctx.parent;
            }
        }
    }

    /**
     * Finds the context of the specified class in the context chain.
     *
     * If there is no context of the required class then returns NOT_A_CONTEXT.
     */
    findContextByClass<T extends Context>(type: Function): T {
        let ctx: Context | undefined = this;

        while (ctx) {
            if (ctx instanceof type) {
                return ctx as T;
            }
            ctx = ctx.parent;
        }

        return NOT_A_CONTEXT;
    }

    /**
     * Forms a portion of the string to be a part of logged message.   Any type of id is possible or
     * an empty string will be returned, if id is missing.
     */
    toString() {
        return this.id === undefined ? '' : `${this.id}: `;
    }
}

/**
 * This is an object that does not contain any context, but allows to execute context.do().
 */
export const NOT_A_CONTEXT = Object.create(Context.prototype);
NOT_A_CONTEXT.id = 'NOT_A_CONTEXT';

/**
 * The current context so that it can be retrieved via getConext().
 */
let _context: any = NOT_A_CONTEXT;

const noop = () => {};
/**
 * Method of generating a new id for a new context.
 */
let newId: () => any = noop;

/**
 * Sets the id generator. By default, the id remain undefined. In case of repeated calls, the first value is taken.
 */
export const setContextNewIdGenerator = (generateNewId: () => any) => {
    if (newId === noop) {
        newId = generateNewId;
    }
};

/**
 * The context must be taken in the begining of a function before a first 'await'.
 *
 * Ex.: *const ctx = getContext();*.
 */
export const getContext = (): Context => _context;
