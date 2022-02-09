import getLogger from './logging';
import {LevelWithSilent, Logger} from 'pino';
import {getCredentialsByType, AuthType, CredentialsOptions} from "./parse-env-vars";
import Driver from './driver';

// for using later in your modules
export let databaseName : string;
export let logger : Logger;
export let entryPoint : string;
export let driver: Driver = null as unknown as Driver; // singleton

export async function initYDBdriver(
    type: AuthType,
    optionsInp: Omit<CredentialsOptions, "logger">,
    dbOptions: { entryPoint: string, databaseName: string },
    logOptionsLevel: LevelWithSilent = 'info'
) {

    if (driver) return; // singleton
    logger = getLogger({level: logOptionsLevel});
    entryPoint = dbOptions.entryPoint;
    databaseName = dbOptions.databaseName;

    const options: CredentialsOptions ={...optionsInp} as CredentialsOptions ;
    options.logger=logger;

    logger.info('Start preparing driver ...');
    const authService = getCredentialsByType(type,options);
    driver = new Driver(entryPoint, databaseName, authService);

    if (!(await driver.ready(10000))) {
        logger.fatal(`Driver has not become ready in 10 seconds!`);
        process.exit(1);
    }
    return driver;
}
