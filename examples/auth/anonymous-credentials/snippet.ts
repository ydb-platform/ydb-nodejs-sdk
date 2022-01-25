import {Driver, Logger, AnonymousAuthService} from 'ydb-sdk';

export async function run(logger: Logger, endpoint: string, database: string) {
    logger.debug('Driver initializing...');
    const driver = new Driver({endpoint, database, authService: new AnonymousAuthService()});
    const timeout = 10000;
    if (!await driver.ready(timeout)) {
        logger.fatal(`Driver has not become ready in ${timeout}ms!`);
        process.exit(1);
    }
}
