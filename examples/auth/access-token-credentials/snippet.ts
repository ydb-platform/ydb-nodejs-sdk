import {Driver, getSslCredentials, Logger, TokenAuthService} from 'ydb-sdk';

export async function run(logger: Logger, entryPoint: string, dbName: string, args?: any) {
    const accessToken = args.ydbAccessToken;
    const sslCredentials = getSslCredentials(entryPoint, logger);
    const authService = new TokenAuthService(accessToken, dbName, sslCredentials);
    logger.debug('Driver initializing...');
    const driver = new Driver(entryPoint, dbName, authService);
    const timeout = 10000;
    if (!await driver.ready(timeout)) {
        logger.fatal(`Driver has not become ready in ${timeout}ms!`);
        process.exit(1);
    }
}

export const options = [{
    key: 'ydbAccessToken',
    name: 'ydb-access-token',
    description: 'access token for YDB authenticate',
}];
