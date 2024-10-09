import {idSymbol, cancelListenersSymbol, errSymbol, doneSymbol, timeoutSymbol} from './symbols';
import Timeout = NodeJS.Timeout;

let currentCtx: Context | undefined;

let count = 0;
const defaultIdGenerator = () => {
    return (++count).toString().padStart(4, '0');
};
let idGenerator = defaultIdGenerator;

export type CtxIdGenerator = () => string;

/**
 * Sets the Context.id generation rule for new contexts. It is desirable to call this funtion at the very beginning of
 * the application before the contexts are used.
 */
export function setContextIdGenerator(_idGenerator?: CtxIdGenerator) {
    if (_idGenerator) idGenerator = _idGenerator;
    else {
        count = 0;
        idGenerator = defaultIdGenerator;
    }
}

interface IContextOpts {
    /**
     * Id for new Context from layer above.
     */
    id?: string,
    /**
     * true - make cancellable context. false - cancel cancellable context.
     * undefined - if parent context is cancelable, then child context is also cancellable and vice versa.
     */
    cancel?: boolean,
    /**
     * cancel context after done.
     */
    done?: boolean,
    /**
     * cancel context after timeout.
     */
    timeout?: number,
    /**
     * Force creation of child context, even if there is no sufficient need.
     */
    force?: boolean,
}

export type CtxDone = () => void;
export type CtxDispose = () => void;
export type CtxUnsubcribe = () => void;
export type CtxCancel = (cuase?: Error) => void;

interface IContextCreateResult {
    ctx: Context,
    cancel?: CtxCancel,
    done?: CtxDone,
    dispose?: CtxDispose,
}

type OnCancelListener = (cause: Error) => void;

interface IContextWrapLambda<T> {
    (ctx: Context, cancel?: CtxCancel, done?: CtxDone): Promise<T>;
}

/**
 * TypeScript Context implementation inspired by golang context (https://pkg.go.dev/context).
 *
 * Supports cancel, timeout, value, done, cancel cancel-chain behaviours.
 */
export class Context {
    [idSymbol]: string;

    [cancelListenersSymbol]?: OnCancelListener[];

    [errSymbol]?: Error;

    /**
     * Similar to value in go context passes arbitrary values through a hierarchy of contexts.
     */
    [key: symbol]: any;

    private constructor(id: string) {
        this[idSymbol] = id;
    }

    /**
     * Unique id of Context Useful for tracing.
     */
    public get id() {
        return this[idSymbol];
    }

    /**
     * That is the cause that was passed to cancel.
     *
     * If defined, the context is cancelled.
     */
    public get err() {
        return this[errSymbol];
    }

    /**
     * If defined, then the context supports cancel.  And it is possible to subscribe to it.
     *
     * @return Function that removes just signed listener from listeners.
     */
    public onCancel?: (listener: OnCancelListener) => CtxUnsubcribe;

    /**
     * Creates a new context.
     */
    public static createNew(opts: IContextOpts = {}): IContextCreateResult {
        const ctx = new Context(typeof opts.id === 'string' ? opts.id : idGenerator());
        const res: any = initContext.call(ctx, opts);
        res.ctx = ctx;
        return res;
    }

    /**
     * Creates a child context from the this one.
     *
     * Note: If there are no sufficient requirements for a new context the parent context
     * will be keep using.
     */
    public createChild(opts: IContextOpts = {}): IContextCreateResult {
        if (opts.id) throw new Error('This method cannot change the context id');
        if (!(
            opts.hasOwnProperty('cancel') ||
            opts.timeout! > 0 ||
            opts.done
        ) && !opts.force) return {ctx: this};
        const ctx = Object.create(this) as Context;
        const originOpts = opts;
        if (this.onCancel)
            if (opts.cancel === false) ctx.onCancel = undefined; // block parent onCancel
            else opts = {...opts, cancel: true};
        const res: any = initContext.call(ctx, opts);
        if (this.onCancel && res.cancel) {
            const unsub = this.onCancel(res.cancel);
            if (res.dispose) {
                const parentDispose = res.dispose;
                res.dispose = () => {
                    parentDispose();
                    unsub();
                };
            } else res.dispose = unsub;
        }
        if (originOpts.cancel !== true) delete res.cancel;
        res.ctx = ctx;
        return res;
    }

    /**
     * Makes a pr   omise cancellable through context, if the context allows cancel or has a timeout.
     */
    public cancelRace<T>(promise: Promise<T>): Promise<T> {
        if (!this.onCancel) return promise;
        let cancelReject: (reason?: any) => void;
        const cancelPromise = new Promise((_, reject) => {
            cancelReject = reject;
        });
        const unsub = this.onCancel((cause) => {
            cancelReject(cause);
        });
        return (Promise.race([promise, cancelPromise]) as Promise<T>).finally(() => {
            unsub();
        });
    }

    /**
     * Wraps a method with a context with specified properties. Just, syntactic sugar.
     */
    public async wrap<T>(opts: IContextOpts, fn: IContextWrapLambda<T>): Promise<T> {
        const {ctx, dispose, cancel, done} = this.createChild(opts);
        try {
            return await ctx.cancelRace(fn(ctx, cancel, done));
        } finally {
            if (dispose) dispose();
        }
    }

    /**
     * True if the reason for canceling is timeout.
     */
    public static isTimeout(cause: any) {
        return typeof cause === 'object' && cause !== null && cause.cause === timeoutSymbol;
    }

    /**
     * True if the reason for canceling is call of ctx.Done() .
     */
    public static isDone(cause: any) {
        return typeof cause === 'object' && cause !== null && cause.cause === doneSymbol;
    }

    public toString() {
        return this[idSymbol];
    }

    /**
     * Passes the context through a global variable, as in _npm context_.
     *
     * Allows context to be passed through code that does not know about the context and cannot be changed.  For example,
     * the code generated by protobufs js.
     *
     * It is important to pick up the context from the same synchronous code block that was called from ctx.do().  Otherwise, the context
     * will be removed or possibly a context from another branch of the logic will be set. Which would create confusion.
     *
     * In practice, if Context.get() is called in an async method.  It should be called before the first await - the easiest way is
     * to get the context in the first line of the function.
     *
     * @param fn a function of the form "() => AFuncOrMethod(...args)", at the moment of calling which the current context will be set.
     */
    public do<T>(fn: () => T): T {
        if (currentCtx !== undefined) throw new Error(`There is a "ctx" that was passed through "ctx.do()" and was not processed till next "ctx.do()": ${currentCtx}`);
        currentCtx = this;
        try {
            return fn();
        } finally {
            // TODO: Think of warning if context is not undefined, so there was no Context.get() call
            currentCtx = undefined;
        }
    }

    /**
     * Returns the current context from global variable. See the description of Context.do() for a detailed explanation.
     */
    public static get() {
        if (!(currentCtx instanceof Context)) throw new Error(`"ctx" was either not passed through Context.do() or was already taken through Context.get()`);
        const ctx = currentCtx;
        currentCtx = undefined;
        return ctx;
    }
}

function makeContextCancellable(context: Context) {
    context.onCancel = (listener) => {
        if (context[errSymbol]) setImmediate(listener.bind(undefined, context[errSymbol]));
        else if (context.hasOwnProperty(cancelListenersSymbol)) context[cancelListenersSymbol]!.push(listener);
        else context[cancelListenersSymbol] = [listener];

        function dispose() { // remove listener from list
            if (context[cancelListenersSymbol]) {
                const index = context[cancelListenersSymbol].indexOf(listener);
                if (index > -1) context[cancelListenersSymbol].splice(index, 1);
            }
        }

        return dispose;
    }

    function cancel(cause?: Error) {
        if (context.hasOwnProperty(errSymbol)) return; // already cancelled
        if (!cause) cause = new Error('Unknown');
        context[errSymbol] = cause;
        context[cancelListenersSymbol]?.forEach((l) => l(cause));
        delete context[cancelListenersSymbol];
    }

    return cancel;
}

function setContextTimeout(timeout: number, cancel: OnCancelListener) {
    let timer: Timeout | undefined = setTimeout(() => {
        // An error is always created rather than using a constant to have an actual callstack
        const err = new Error(`Timeout: ${timeout} ms`);
        (err as any).cause = timeoutSymbol;
        cancel(err);
    }, timeout);
    function dispose() {
        if (timer) {
            clearTimeout(timer);
            timer = undefined;
        }
    }
    return dispose;
}

function createDone(cancel: OnCancelListener) {
    function done() {
        // The error is always created rather than using a constant to have an actual callstack
        const err = new Error('Done');
        (err as any).cause = doneSymbol;
        cancel(err);
    }
    return done;
}

function initContext(this: Context, opts: IContextOpts) {
    const res: Omit<IContextCreateResult, 'ctx'> = {};
    let cancel: OnCancelListener;
    if (opts.cancel === true) res.cancel = cancel = makeContextCancellable(this);
    if (opts.timeout! > 0) res.dispose = setContextTimeout(opts.timeout!, cancel! || (cancel = makeContextCancellable(this)));
    if (opts.done) res.done = createDone(cancel! || makeContextCancellable(this));
    return res;
}
