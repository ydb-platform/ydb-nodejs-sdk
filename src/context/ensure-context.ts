import {Context} from "./context";

/**
 * Decorator that ensures:
 * - in the case of positional arguments, the first argument type is Context.
 * - in case of named arguments there is a non-null named argument ctx of type Context.
 *
 * If the context was not passed in the initial parameters, a new context with a unique id
 * will be added to the parameters by this decorator.
 *
 * @param isPositionalArgs
 */
export function ensureContext(isPositionalArgs?: boolean) { // TODO: Should I got logger somehow?
    return (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;
        // const wrappedMethodName = `${target.constructor.name}::${propertyKey}`; // for regular method
        // const wrappedMethodName = ???; // for static method
        descriptor.value = async function (...args: any[]) {
            if (isPositionalArgs) {
                if (!(args[0] instanceof Context)) {
                    args.unshift(Context.createNew().ctx);
                }
            } else {
                let opts = args[0] as any;
                if (opts === undefined)
                    args[0] = opts = {};
                else if (!(typeof opts === 'object' && opts !== null))
                    throw new Error('An object with options or undefined is expected as the first argument');
                if (!(opts.ctx instanceof Context))
                    opts.ctx = Context.createNew().ctx;
            }
            return originalMethod.apply(this, args);
        };
    };
}
