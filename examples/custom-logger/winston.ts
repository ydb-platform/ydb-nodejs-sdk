import {mainWithoutLogger} from '../utils';
import {Driver, getCredentialsFromEnv, Logger, setupLogger} from 'ydb-sdk';
import winston from 'winston';

export async function run(endpoint: string, database: string) {
    const logger: Logger = winston.createLogger({
        level: 'debug',
        format: winston.format.json(),
        defaultMeta: {service: 'user-service'},
        transports: [new winston.transports.Console({format: winston.format.simple()})],
        levels: {
            ...winston.config.npm.levels,
            fatal: 0,
            trace: 6,
        },
    }) as unknown as Logger;
    /* 
    Log levels accordance:
    YDB-SDK-logger -> winston (npm levels)
    fatal -> !!! no such level, set exact as error
    error -> error
    warn -> warn
    info -> info
    debug -> debug
    trace -> silly(6)
    */
    setupLogger(logger);
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

mainWithoutLogger(run);
