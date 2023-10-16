/**
 * Context object allows to pass a value thru function calls stack.
 *
 * To do this, you need to call functions like "context.do(() => [some function])".  And in this "some function" at the
 * beginning execute "const context = getContext();".
 *
 * Create a new context - "new Context([any optional value])".
 *
 * Getting the context value "... = context.value".
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
 * Default context has "context.id === undefined".
 */
let _context: any = new Context();

let newId: () => any = () => undefined;

/**
 * Set the id generator for a new context. By default, the id remain undefined.
 *
 * @param generateNewId
 */
export function setContextNewId(generateNewId: () => any) {
    newId = generateNewId;
}

/**
 * The context must be taken in the beging function before a first await.
 *
 * const context = getContext();
 */
export function getContext(): Context {
    return _context;
}
