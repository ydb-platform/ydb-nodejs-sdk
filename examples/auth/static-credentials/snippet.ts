import {Driver, StaticCredentialsAuthService, Logger} from 'ydb-sdk';

export async function run(logger: Logger, endpoint: string, database: string, args?: any) {
    logger.info('Driver initializing...');
    const {user, password} = args;
    const authService = new StaticCredentialsAuthService(user, password, endpoint)
    const driver = new Driver({endpoint, database, authService});
    const timeout = 100000;
    if (!await driver.ready(timeout)) {
        logger.fatal(`Driver has not become ready in ${timeout}ms!`);
        process.exit(1);
    }
    logger.info('Done');
}

export const options = [{
    key: 'user',
    name: 'user',
    description: 'user for YDB authentication',
},{
    key: 'password',
    name: 'password',
    description: 'password for YDB authentication',
}];
