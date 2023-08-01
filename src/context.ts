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

    constructor(readonly value?: any) { }

    do<T>(func: () => T): T {
        const prevContext = _context;
        try {
            _context = this;
            return func();
        } finally {
            _context = prevContext;
        }
    }
}

/**
 * Default context has "context.value === undefined".
 */
let _context: any = new Context();

/**
 * The context must be taken before a first await, it is more reliable to take it in the first line of the function.
 *
 * const context = getContext();
 */
export function getContext(): Context {
    return _context;
}
