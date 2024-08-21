"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Context = exports.setContextIdGenerator = void 0;
var symbols_1 = require("./symbols");
var currentCtx;
var count = 0;
var defaultIdGenerator = function () {
    return (++count).toString().padStart(4, '0');
};
var idGenerator = defaultIdGenerator;
/**
 * Sets the Context.id generation rule for new contexts. It is desirable to call this funtion at the very beginning of
 * the application before the contexts are used.
 */
function setContextIdGenerator(_idGenerator) {
    if (_idGenerator)
        idGenerator = _idGenerator;
    else {
        count = 0;
        idGenerator = defaultIdGenerator;
    }
}
exports.setContextIdGenerator = setContextIdGenerator;
/**
 * TypeScript Context implementation inspired by golang context (https://pkg.go.dev/context).
 *
 * Supports cancel, timeout, value, done, cancel cancel-chain behaviours.
 */
var Context = /** @class */ (function () {
    function Context(id) {
        this[symbols_1.idSymbol] = id;
    }
    Object.defineProperty(Context.prototype, "id", {
        /**
         * Unique id of Context Useful for tracing.
         */
        get: function () {
            return this[symbols_1.idSymbol];
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Context.prototype, "err", {
        /**
         * That is the cause that was passed to cancel.
         *
         * If defined, the context is cancelled.
         */
        get: function () {
            return this[symbols_1.errSymbol];
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Creates a new context.
     */
    Context.createNew = function (opts) {
        if (opts === void 0) { opts = {}; }
        var ctx = new Context(typeof opts.id === 'string' ? opts.id : idGenerator());
        var res = initContext.call(ctx, opts);
        res.ctx = ctx;
        return res;
    };
    /**
     * Creates a child context from the this one.
     *
     * Note: If there are no sufficient requirements for a new context the parent context
     * will be keep using.
     */
    Context.prototype.createChild = function (opts) {
        if (opts === void 0) { opts = {}; }
        if (opts.id)
            throw new Error('This method cannot change the context id');
        if (!(opts.hasOwnProperty('cancel') ||
            opts.timeout > 0 ||
            opts.done) && !opts.force)
            return { ctx: this };
        var ctx = Object.create(this);
        var originOpts = opts;
        if (this.onCancel)
            if (opts.cancel === false)
                ctx.onCancel = undefined; // block parent onCancel
            else
                opts = __assign(__assign({}, opts), { cancel: true });
        var res = initContext.call(ctx, opts);
        if (this.onCancel && res.cancel) {
            var unsub_1 = this.onCancel(res.cancel);
            if (res.dispose) {
                var parentDispose_1 = res.dispose;
                res.dispose = function () {
                    parentDispose_1();
                    unsub_1();
                };
            }
            else
                res.dispose = unsub_1;
        }
        if (originOpts.cancel !== true)
            delete res.cancel;
        res.ctx = ctx;
        return res;
    };
    /**
     * Makes a promise cancellable through context, if the context allows cancel or has a timeout.
     */
    Context.prototype.cancelRace = function (promise) {
        if (!this.onCancel)
            return promise;
        var cancelReject;
        var cancelPromise = new Promise(function (_, reject) {
            cancelReject = reject;
        });
        var unsub = this.onCancel(function (cause) {
            cancelReject(cause);
        });
        return Promise.race([promise, cancelPromise]).finally(function () {
            unsub();
        });
    };
    /**
     * Wraps a method with a context with specified properties. Just, syntactic sugar.
     */
    Context.prototype.wrap = function (opts, fn) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, ctx, dispose, cancel, done;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.createChild(opts), ctx = _a.ctx, dispose = _a.dispose, cancel = _a.cancel, done = _a.done;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, , 3, 4]);
                        return [4 /*yield*/, ctx.cancelRace(fn(ctx, cancel, done))];
                    case 2: return [2 /*return*/, _b.sent()];
                    case 3:
                        if (dispose)
                            dispose();
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * True if the reason for canceling is timeout.
     */
    Context.isTimeout = function (cause) {
        return cause.cause === symbols_1.timeoutSymbol;
    };
    /**
     * True if the reason for canceling is call of ctx.Done() .
     */
    Context.isDone = function (cause) {
        return cause.cause === symbols_1.doneSymbol;
    };
    Context.prototype.toString = function () {
        return this[symbols_1.idSymbol];
    };
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
    Context.prototype.do = function (fn) {
        if (currentCtx !== undefined)
            throw new Error("There is a \"ctx\" that was passed through \"ctx.do()\" and was not processed till next \"ctx.do()\": ".concat(currentCtx));
        currentCtx = this;
        try {
            return fn();
        }
        finally {
            // TODO: Think of warning if context is not undefined, so there was no Context.get() call
            currentCtx = undefined;
        }
    };
    /**
     * Returns the current context from global variable. See the description of Context.do() for a detailed explanation.
     */
    Context.get = function () {
        if (!(currentCtx instanceof Context))
            throw new Error("\"ctx\" was either not passed through Context.do() or was already taken through Context.get()");
        var ctx = currentCtx;
        currentCtx = undefined;
        return ctx;
    };
    return Context;
}());
exports.Context = Context;
function makeContextCancellable(context) {
    context.onCancel = function (listener) {
        if (context[symbols_1.errSymbol])
            setImmediate(listener.bind(undefined, context[symbols_1.errSymbol]));
        else if (context.hasOwnProperty(symbols_1.cancelListenersSymbol))
            context[symbols_1.cancelListenersSymbol].push(listener);
        else
            context[symbols_1.cancelListenersSymbol] = [listener];
        function dispose() {
            if (context[symbols_1.cancelListenersSymbol]) {
                var index = context[symbols_1.cancelListenersSymbol].indexOf(listener);
                if (index > -1)
                    context[symbols_1.cancelListenersSymbol].splice(index, 1);
            }
        }
        return dispose;
    };
    function cancel(cause) {
        var _a;
        if (context.hasOwnProperty(symbols_1.errSymbol))
            return; // already cancelled
        if (!cause)
            cause = new Error('Unknown');
        context[symbols_1.errSymbol] = cause;
        (_a = context[symbols_1.cancelListenersSymbol]) === null || _a === void 0 ? void 0 : _a.forEach(function (l) { return l(cause); });
        delete context[symbols_1.cancelListenersSymbol];
    }
    return cancel;
}
function setContextTimeout(timeout, cancel) {
    var timer = setTimeout(function () {
        // An error is always created rather than using a constant to have an actual callstack
        var err = new Error("Timeout: ".concat(timeout, " ms"));
        err.cause = symbols_1.timeoutSymbol;
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
function createDone(cancel) {
    function done() {
        // The error is always created rather than using a constant to have an actual callstack
        var err = new Error('Done');
        err.cause = symbols_1.doneSymbol;
        cancel(err);
    }
    return done;
}
function initContext(opts) {
    var res = {};
    var cancel;
    if (opts.cancel === true)
        res.cancel = cancel = makeContextCancellable(this);
    if (opts.timeout > 0)
        res.dispose = setContextTimeout(opts.timeout, cancel || (cancel = makeContextCancellable(this)));
    if (opts.done)
        res.done = createDone(cancel || makeContextCancellable(this));
    return res;
}
