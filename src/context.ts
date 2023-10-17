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

    constructor(parent?: Context) {
        if (parent) {
            if (parent.id) {
                this.id = parent.id;
            }
            this.parent = parent;
        } else {
            const id = newId();
            if (id) {
                this.id = id;
            }
        }
    }

    do<T>(func: () => T): T {
        const prevContext = _context;
        try {
            _context = this;
            return func();
        } finally {
            _context = prevContext;
        }
    }

    findContextByClass<T extends Context>(type: Function): T | null {
        let ctx: Context | undefined = this;

        while (ctx) {
            if (ctx instanceof type) {
                return ctx as T;
            }
            ctx = ctx.parent;
        }

        return null;
    }

    toString() {
        return this.id ? `${this.id}: ` : '';
    }
}

/**
 * This is an object that does not contain any context, but allows to execute context.do().
 */
const NOT_A_CONTEXT = Object.create(Context.prototype);

/**
 * The current context so that it can be retrieved via getConext().
 */
let _context: any = NOT_A_CONTEXT;

/**
 * Method of generating a new id for a new context.
 */
let newId: () => any = () => undefined;

/**
 * Sets the id generator. By default, the id remain undefined.
 */
export function setContextNewId(generateNewId: () => any) {
    newId = generateNewId;
}

/**
 * The context must be taken in the begining of a function before a first 'await'.
 *
 * Ex.: const context = getContext();
 */
export function getContext(): Context {
    return _context;
}
