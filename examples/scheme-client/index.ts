process.env.YDB_SDK_PRETTY_LOGS = '1';

import {Driver, getCredentialsFromEnv, Logger} from 'ydb-sdk';
import {main} from '../utils';


async function run(logger: Logger, entryPoint: string, dbName: string): Promise<void> {
    const authService = getCredentialsFromEnv(entryPoint, dbName, logger);
    logger.info('Driver initializing...');
    const driver = new Driver(entryPoint, dbName, authService);
    const timeout = 10000;
    if (!await driver.ready(timeout)) {
        logger.fatal(`Driver has not become ready in ${timeout}ms!`);
        process.exit(1);
    }

    logger.info('Testing scheme client capabilities...');
    await driver.schemeClient.makeDirectory('example-path');
    await driver.schemeClient.makeDirectory('example-path/subpath');
    await driver.schemeClient.modifyPermissions(
        'example-path/subpath',
        [{
            grant: {
                subject: 'tsufiev@staff',
                permissionNames: ['read', 'use']
            }
        }]
    );
    const entry = await driver.schemeClient.describePath('example-path');
    const children = await driver.schemeClient.listDirectory('example-path');
    logger.info(`Created path: ${JSON.stringify(entry, null, 2)}`);
    logger.info(`Path contents: ${JSON.stringify(children, null, 2)}`);
    await driver.schemeClient.removeDirectory('example-path/subpath');
    await driver.schemeClient.removeDirectory('example-path');
}

main(run);
