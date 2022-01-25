import {Driver, Logger, TokenAuthService} from 'ydb-sdk';

export async function run(logger: Logger, endpoint: string, database: string, args?: any) {
    logger.debug('Driver initializing...');
    const accessToken = args.ydbAccessToken;
    const authService = new TokenAuthService(accessToken);
    const driver = new Driver({endpoint, database, authService});
    const timeout = 10000;
    if (!await driver.ready(timeout)) {
        logger.fatal(`Driver has not become ready in ${timeout}ms!`);
        process.exit(1);
    }
}

export const options = [{
    key: 'ydbAccessToken',
    name: 'ydb-access-token',
    description: 'access token for YDB authentication',
}];
