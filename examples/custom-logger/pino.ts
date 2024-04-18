import {mainWithoutLogger} from '../utils';
import {Driver, getCredentialsFromEnv/*, setupLogger*/} from 'ydb-sdk';
import pino from 'pino';

export async function run(endpoint: string, database: string) {
    const logger = pino({level: 'debug'});
    logger.info('Driver initializing...');
    // setupLogger(logger);
    const authService = getCredentialsFromEnv();
    const driver = new Driver({endpoint, database, authService, logger});
    const timeout = 10000;
    if (!(await driver.ready(timeout))) {
        logger.fatal(`Driver has not become ready in ${timeout}ms!`);
        process.exit(1);
    }
    logger.info('Done, destroy driver');
    await driver.destroy();
    process.exit(0);
}

mainWithoutLogger(run);
