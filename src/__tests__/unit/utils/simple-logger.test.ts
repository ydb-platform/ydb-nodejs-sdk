import { SimpleLogger, setMockConsole } from '../../../utils/simple-logger';
import { FakeTimersFixture } from '../../../utils/tests/fake-timers-fixture';
import Mock = jest.Mock;

describe('utils.simple-logger', () => {
    let oldLL: string | undefined;
    let mockConsole: typeof console | undefined;

    beforeEach(() => {
        oldLL = process.env.LOG_LEVEL;
        delete process.env.LOG_LEVEL;
        setMockConsole(mockConsole = {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
            trace: jest.fn(),
        } as unknown as typeof console);
    });

    afterEach(() => {
        setMockConsole(mockConsole = undefined);
        if (oldLL !== undefined) {
            process.env.LOG_LEVEL = oldLL;
        }
    });

    for (const env of [false, true, 'AAA']) {
        for (const conf of [
            {
                level: undefined,
                fatal: true,
                error: true,
                warn: true,
                info: true,
                debug: false,
                trace: false,
            },
            {
                level: SimpleLogger.LogLevel.warn,
                fatal: true,
                error: true,
                warn: true,
                info: false,
                debug: false,
                trace: false,
            },
            {
                level: SimpleLogger.LogLevel.debug,
                fatal: true,
                error: true,
                warn: true,
                info: true,
                debug: true,
                trace: false,
            },
            {
                level: 'wrong' as SimpleLogger.LogLevel,
                fatal: true,
                error: true,
                warn: true,
                info: true,
                debug: true,
                trace: true,
            }]) {
            if (conf.level === undefined && env) continue; // makes no sense - sounds like ENV says that level is undefined;

            // eslint-disable-next-line @typescript-eslint/no-loop-func
            it(`general: ${env}, ${conf.level}`, () => {
                let logger: SimpleLogger.Logger;

                switch (env) {
                    case false:
                        logger = conf.level === undefined
                            ? new SimpleLogger({ showLevel: false, showTimestamp: false })
                            : new SimpleLogger({ level: conf.level, showLevel: false, showTimestamp: false });
                        break;
                    case true:
                        process.env.LOG_LEVEL = conf.level;
                        logger = new SimpleLogger({ showLevel: false, showTimestamp: false });
                        break;
                    default:
                        process.env[env] = conf.level;
                        logger = new SimpleLogger({ envKey: env, showLevel: false, showTimestamp: false });
                        delete process.env[env];
                }

                logger.fatal('fatal');
                logger.error('error');
                logger.warn('warn');
                logger.info('info');
                logger.debug('debug');
                logger.trace('trace');

                // @ts-ignore
                expect((mockConsole.error as Mock).mock.calls)
                    .toHaveLength((conf.fatal ? 1 : 0) + (conf.error ? 1 : 0));
                // @ts-ignore
                expect((mockConsole.warn as Mock).mock.calls)
                    .toHaveLength(conf.warn ? 1 : 0);
                // @ts-ignore
                expect((mockConsole.info as Mock).mock.calls)
                    .toHaveLength(conf.info ? 1 : 0);
                // @ts-ignore
                expect((mockConsole.debug as Mock).mock.calls)
                    .toHaveLength(conf.debug ? 1 : 0);
                // @ts-ignore
                expect((mockConsole.trace as Mock).mock.calls)
                    .toHaveLength(conf.trace ? 1 : 0);
            });
        }
    }

    it('different parameters of log method', () => {
        const logger = new SimpleLogger({ showLevel: false, showTimestamp: false });

        const a = {
            b: {
                a: {},
            },
        };

        a.b.a = a; // circular object

        logger.info('simple message');
        logger.info('simple message with inline: %s', '123');
        logger.info(a, 'message with object');
        logger.info(a, 'message with object and inline: %d', 21);
        logger.info(a);

        // @ts-ignore
        expect((mockConsole.info as Mock).mock.calls)
            .toEqual([
                ['simple message'],
                ['simple message with inline: %s', '123'],
                ['%o message with object', a],
                ['%o message with object and inline: %d', 21, a],
                ['%o', a],
            ]);
    });

    for (const prefix of [undefined, 'test']) {
        for (const showTimestamp of [false, true]) {
            for (const showLevel of [false, true]) {
                // eslint-disable-next-line @typescript-eslint/no-loop-func
                it(`prefix, mshowTimestamp, showLevel: ${prefix}, ${showTimestamp}, ${showLevel}`, () => {
                    const fakeTimersFixture = new FakeTimersFixture();
                    const logger = new SimpleLogger({
                        prefix,
                        showTimestamp,
                        showLevel,
                    });

                    fakeTimersFixture.setup();

                    logger.warn('message');
                    logger.warn({});
                    logger.warn({}, 'text');

                    const msgPrefix: string[] = [];

                    if (showTimestamp) {
                        msgPrefix.push(new Date().toISOString());
                    }

                    if (showLevel) {
                        msgPrefix.push('WARN');
                    }

                    if (prefix) {
                        msgPrefix.push(prefix);
                    }

                    // @ts-ignore
                    expect((mockConsole.warn as Mock).mock.calls)
                        .toEqual([
                            [`${msgPrefix.length === 0 ? '' : `[${msgPrefix.join(' ')}] `}message`],
                            [`${msgPrefix.length === 0 ? '%o' : `[${msgPrefix.join(' ')}] %o`}`, {}],
                            [`${msgPrefix.length === 0 ? '%o text' : `[${msgPrefix.join(' ')}] %o text`}`, {}],
                        ]);

                    fakeTimersFixture.dispose();
                });
            }
        }
    }
});
