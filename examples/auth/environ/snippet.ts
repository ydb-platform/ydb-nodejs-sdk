import {Driver, Logger, getCredentialsFromEnv} from 'ydb-sdk';

export async function run(logger: Logger, endpoint: string, database: string) {
    logger.debug('Driver initializing...');
    const authService = getCredentialsFromEnv();
    const driver = new Driver({endpoint, database, authService});
    const timeout = 10000;
    if (!await driver.ready(timeout)) {
        logger.fatal(`Driver has not become ready in ${timeout}ms!`);
        process.exit(1);
    }
}
