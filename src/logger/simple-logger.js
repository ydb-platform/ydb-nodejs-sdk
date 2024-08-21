"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleLogger = exports.setMockConsole = exports.LogLevel = exports.DEFAULT_LEVEL = exports.DEFAULT_ENV_KEY = void 0;
exports.DEFAULT_ENV_KEY = 'YDB_LOG_LEVEL';
exports.DEFAULT_LEVEL = 'info';
var LogLevel;
(function (LogLevel) {
    LogLevel["none"] = "none";
    LogLevel["fatal"] = "fatal";
    LogLevel["error"] = "error";
    LogLevel["warn"] = "warn";
    LogLevel["info"] = "info";
    LogLevel["debug"] = "debug";
    LogLevel["trace"] = "trace";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * For unit tests purposes.
 */
var consoleOrMock = console;
/**
 * **Only for unit tests purposes**.
 */
var setMockConsole = function (mockConsole) {
    if (mockConsole === void 0) { mockConsole = console; }
    consoleOrMock = mockConsole;
};
exports.setMockConsole = setMockConsole;
var silentLogFn = function () { };
var simpleLogFnBuilder = function (level) {
    var LEVEL = level.toUpperCase();
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (level === LogLevel.fatal) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define,no-param-reassign
        level = LogLevel.error;
    }
    return function log(objOrMsg) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var prefix = [];
        if (this.showTimestamp) {
            prefix.push(new Date().toISOString());
        }
        if (this.showLevel) {
            prefix.push(LEVEL);
        }
        if (this.prefix) {
            prefix.push(this.prefix);
        }
        var prefixStr = prefix.length === 0 ? '' : "[".concat(prefix.join(' '), "] ");
        if (typeof objOrMsg === 'object') {
            if (typeof args[0] === 'string') {
                // @ts-ignore
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                consoleOrMock[level].apply(consoleOrMock, __spreadArray(__spreadArray(["".concat(prefixStr, "%o ").concat(args[0])], args.splice(1), false), [objOrMsg], false));
            }
            else {
                // @ts-ignore
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                consoleOrMock[level](prefix.length > 0 ? "".concat(prefixStr, "%o") : '%o', objOrMsg);
            }
        }
        else {
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            consoleOrMock[level].apply(consoleOrMock, __spreadArray(["".concat(prefixStr).concat(objOrMsg)], args, false));
        }
    };
};
/**
 * The simplest logger class, with a minimal set of logging methods and the most simple output to the console.
 */
var SimpleLogger = /** @class */ (function () {
    function SimpleLogger(options) {
        if (options === void 0) { options = {}; }
        var _a;
        this.fatal = silentLogFn;
        this.error = silentLogFn;
        this.warn = silentLogFn;
        this.info = silentLogFn;
        this.debug = silentLogFn;
        this.trace = silentLogFn;
        var level = options.level, 
        // eslint-disable-next-line prefer-const
        prefix = options.prefix, 
        // eslint-disable-next-line prefer-const
        showTimestamp = options.showTimestamp, 
        // eslint-disable-next-line prefer-const
        showLevel = options.showLevel;
        if (prefix)
            this.prefix = prefix;
        this.showTimestamp = showTimestamp !== null && showTimestamp !== void 0 ? showTimestamp : true;
        this.showLevel = showLevel !== null && showLevel !== void 0 ? showLevel : true;
        var envKey = (_a = options.envKey) !== null && _a !== void 0 ? _a : exports.DEFAULT_ENV_KEY;
        var envLevel = process.env[envKey];
        // @ts-ignore
        level = envLevel === undefined ? level !== null && level !== void 0 ? level : LogLevel[exports.DEFAULT_LEVEL] : LogLevel[envLevel];
        for (var _i = 0, _b = Object.values(LogLevel); _i < _b.length; _i++) {
            var lvl = _b[_i];
            if (lvl === LogLevel.none)
                continue;
            // @ts-ignore
            this[lvl] = simpleLogFnBuilder(lvl);
            if (lvl === level)
                break;
        }
    }
    return SimpleLogger;
}());
exports.SimpleLogger = SimpleLogger;
