import {main} from '../utils';
import {Logger, LogFn, Driver, getCredentialsFromEnv, setDefaultLogger} from 'ydb-sdk';

const logFunction: LogFn = (obj: any, ...args: any[]) => {
    console.log('Custom logging!', obj, ...args)
};
const MyLogger: Logger = {
    fatal: logFunction,
    error: logFunction,
    warn: logFunction,
    info: logFunction,
    debug: logFunction,
    trace: logFunction
}

setDefaultLogger(MyLogger)

export async function run(logger: Logger, endpoint: string, database: string) {
    logger.info('Driver initializing...');
    const authService = getCredentialsFromEnv();
    const driver = new Driver({endpoint, database, authService});
    const timeout = 10000;
    if (!await driver.ready(timeout)) {
        logger.fatal(`Driver has not become ready in ${timeout}ms!`);
        process.exit(1);
    }
    logger.info('Done');
    driver.destroy()

}

main(run);
