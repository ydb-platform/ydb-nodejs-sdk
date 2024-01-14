// TODO: Add constructor with new id, to chain contexts into few sub spans

/**
 * Context object allows to pass a currentContext-chain (number of contexts, linked by "parent" field) through function calls stack.
 *
 * To do this, you need to call functions like "currentContext.do(() => [some function])".  And in this "some function" at the
 * beginning execute "const currentContext = getContext();".
 *
 * Create a new currentContext - "new Context(currentContext?)".  If currentContext is provided, then new currentContext considers it as
 * a child-currentContext. Otherwise, it is new currentContext with an id, if newId() function was specified.
 *
 * Getting the currentContext fields "... = currentContext...".  Also, currentContext might have methods.
 *
 * Specific part of currentContext-chain can be obtained through findContextByClass() method.
 */
export class Context {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly id?: any;
    readonly chain?: [Context];

    /**
     * A non-required method that is called after the function, and allows you to collect the method
     * run time and close spans for tracing.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected done?: (error?: any) => void;

    constructor(parent?: Context) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        if (parent && parent !== NOT_A_CONTEXT) {
            if (parent.id !== undefined) {
                this.id = parent.id;
            }
            if (parent.chain) {
                (this.chain = parent.chain).unshift(parent);
            } else {
                // @ts-ignore
                this.chain = [this, parent];
            }
        } else {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            const id = newId();

            if (id !== undefined) {
                this.id = id;
            }
        }
    }

    /**
     * Calls the method passed as a callback with pass in the currentContext from which the method was called.
     *
     * The currentContext can be obtained in the first line of the called function - *const ctx.do = getContext();*.
     */
    async do<T>(callback: () => T): Promise<T> {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const prevContext = currentContext;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let error: any;

        try {
            // eslint-disable-next-line max-len
            // eslint-disable-next-line @typescript-eslint/no-this-alias, @typescript-eslint/no-use-before-define, unicorn/no-this-assignment
            currentContext = this;

            const res = callback();

            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            currentContext = prevContext;

            return await Promise.resolve(res);
        } catch (_error) {
            error = _error;
            throw error;
        } finally {
            if (this.chain) {
                for (const ctx of this.chain) {
                    if (ctx.done) {
                        ctx.done(error);
                    }
                }
            } else if (this.done) {
                this.done(error);
            }
        }
    }

    /**
     * Calls the method passed as a callback with pass in the currentContext from which the method was called.
     *
     * The currentContext can be obtained in the first line of the called function - *const ctx.do = getContext();*.
     *
     * Sync version primarily required to call anything within constructors.
     */
    doSync<T>(callback: () => T): T {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const prevContext = currentContext;
        // eslint-disable-next-line max-len
        // eslint-disable-next-line unicorn/no-this-assignment, @typescript-eslint/no-this-alias, @typescript-eslint/no-explicit-any
        let error: any;

        try {
            // eslint-disable-next-line max-len
            // eslint-disable-next-line unicorn/no-this-assignment, @typescript-eslint/no-this-alias, @typescript-eslint/no-use-before-define
            currentContext = this;

            return callback();
        } catch (_error) {
            error = _error;
            throw error;
        } finally {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            currentContext = prevContext;
            if (this.chain) {
                for (const ctx of this.chain) {
                    if (ctx.done) {
                        ctx.done(error);
                    }
                }
            } else if (this.done) {
                this.done(error);
            }
        }
    }

    /**
     * Finds the currentContext of the specified class in the currentContext chain.
     *
     * If there is no currentContext of the required class then returns NOT_A_CONTEXT.
     */
    // eslint-disable-next-line @typescript-eslint/ban-types
    findContextByClass<T extends Context>(type: Function): T {
        if (this.chain) {
            for (const ctx of this.chain) {
                if (ctx instanceof type) {
                    return ctx as T;
                }
            }
        } else if (this instanceof type) {
            return this as unknown as T;
        }

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
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
 * This is an object that does not contain any currentContext, but allows to execute currentContext.do().
 */
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-use-before-define
export const NOT_A_CONTEXT = Object.create(Context.prototype);
NOT_A_CONTEXT.id = 'NOT_A_CONTEXT';

/**
 * The current currentContext so that it can be retrieved via getContext().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentContext: any = NOT_A_CONTEXT;

const noop = () => {
};
/**
 * Method of generating a new id for a new currentContext.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let newId: () => any = noop;

/**
 * Sets the id generator. By default, the id remain undefined. In case of repeated calls, the first value is taken.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const setContextNewIdGenerator = (generateNewId: () => any) => {
    if (newId === noop) {
        newId = generateNewId;
    }
};

/**
 * The currentContext must be taken in the beginning of a function before a first 'await'.
 *
 * Ex.: *const ctx.do = getContext();*.
 */
export const getContext = (): Context => currentContext;
