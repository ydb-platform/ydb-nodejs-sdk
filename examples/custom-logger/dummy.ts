import {main} from '../utils';
import {Logger, LogFn, Driver, getCredentialsFromEnv, setupLogger, setDefaultLogger} from 'ydb-sdk';

const logFunction: LogFn = (obj: any, ...args: any[]) => {
    console.log('Custom logging!', obj, ...args);
};
const MyLogger: Logger = {
    fatal: logFunction,
    error: logFunction,
    warn: logFunction,
    info: logFunction,
    debug: logFunction,
    trace: logFunction,
};

export async function run(logger: Logger, endpoint: string, database: string) {
    setupLogger(MyLogger);
    // setDefaultLogger(MyLogger); // will work too
    logger.info('Driver initializing...');
    const authService = getCredentialsFromEnv();
    const driver = new Driver({endpoint, database, authService});
    const timeout = 10000;
    if (!(await driver.ready(timeout))) {
        logger.fatal(`Driver has not become ready in ${timeout}ms!`);
        process.exit(1);
    }
    logger.info('Done, destroy driver');
    await driver.destroy();
    process.exit(0);
}

main(run);
