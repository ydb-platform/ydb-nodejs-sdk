export const DEFAULT_ENV_KEY = 'YDB_LOG_LEVEL';
export const DEFAULT_LEVEL = 'info';

export enum LogLevel {
    fatal = 'fatal',
    error = 'error',
    warn = 'warn',
    info = 'info',
    debug = 'debug',
    trace = 'trace',
}

export interface Logger {
    fatal: LogFn,
    error: LogFn,
    warn: LogFn,
    info: LogFn,
    debug: LogFn,
    trace: LogFn,
}

/**
 * For unit tests purposes.
 */
let consoleOrMock = console;

/**
 * **Only for unit tests purposes**.
 */
export const setMockConsole = (mockConsole: Console = console) => {
    consoleOrMock = mockConsole;
};

const silentLogFn = () => {};

const simpleLogFnBuilder = (level: LogLevel): LogFn => {
    const LEVEL = level.toUpperCase();

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (level === LogLevel.fatal) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define,no-param-reassign
        level = LogLevel.error;
    }

    return function log(this: SimpleLogger, objOrMsg: string | unknown, ...args: unknown[]) {
        const prefix: string[] = [];

        if (this.showTimestamp) {
            prefix.push(new Date().toISOString());
        }

        if (this.showLevel) {
            prefix.push(LEVEL);
        }

        if (this.prefix) {
            prefix.push(this.prefix);
        }

        const prefixStr = prefix.length === 0 ? '' : `[${prefix.join(' ')}] `;

        if (typeof objOrMsg === 'object') {
            if (typeof args[0] === 'string') {
                // @ts-ignore
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                consoleOrMock[level](`${prefixStr}%o ${args[0]}`, ...args.splice(1), objOrMsg);
            } else {
                // @ts-ignore
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                consoleOrMock[level](prefix.length > 0 ? `${prefixStr}%o` : '%o', objOrMsg);
            }
        } else {
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            consoleOrMock[level](`${prefixStr}${objOrMsg}`, ...args);
        }
    };
};

/**
 * The simplest logger class, with a minimal set of logging methods and the most simple output to the console.
 */
export class SimpleLogger implements Logger {
    fatal: LogFn = silentLogFn;
    error: LogFn = silentLogFn;
    warn: LogFn = silentLogFn;
    info: LogFn = silentLogFn;
    debug: LogFn = silentLogFn;
    trace: LogFn = silentLogFn;

    readonly prefix?: string;

    readonly showTimestamp: boolean;
    readonly showLevel: boolean;

    constructor(options: {
        /**
         * Level down to which to log messages. Default is *info*.
         */
        level?: LogLevel,
        /**
         * Prefix that gets added to a message, default undefined
         */
        prefix?: string,
        /**
         * Whether to add the date and time to the message. Default is true.
         */
        showTimestamp?: boolean,
        /**
         * Whether to add the message level. Default is true.
         */
        showLevel?: boolean,
        /**
         * Environment variable with logging level, which if specified contains the level of
         * logging - *error*, *warn*, *info*, *debug*, *trace*. If not specified, the value of
         * level parameter is used.  If a non-existing level value is specified, all levels are logged.
         */
        envKey?: string,
    } = {}) {
        let {
            level,
            // eslint-disable-next-line prefer-const
            prefix,
            // eslint-disable-next-line prefer-const
            showTimestamp,
            // eslint-disable-next-line prefer-const
            showLevel,
        } = options;

        if (prefix) this.prefix = prefix;
        this.showTimestamp = showTimestamp ?? true;
        this.showLevel = showLevel ?? true;

        const envKey = options.envKey ?? DEFAULT_ENV_KEY;
        const envLevel = process.env[envKey];

        // @ts-ignore
        level = envLevel === undefined ? level ?? LogLevel[DEFAULT_LEVEL] : LogLevel[envLevel];

        for (const lvl of Object.values<LogLevel>(LogLevel)) {
            // @ts-ignore
            this[lvl] = simpleLogFnBuilder(lvl);
            if (lvl === level) break;
        }
    }
}

export interface LogFn {
    (obj: unknown, msg?: string, ...args: unknown[]): void;
    (msg: string, ...args: unknown[]): void;
}
