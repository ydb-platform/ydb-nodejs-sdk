import {getLogger, Logger} from 'ydb-sdk';


export interface Runner {
    (logger: Logger, entryPoint: string, dbName: string): Promise<void>;
}

export async function main(runner: Runner) {
    const [,, entryPoint, dbName] = process.argv;
    const logger = getLogger({level: 'debug'});
    if (!entryPoint) {
        logger.fatal('Cluster entry-point is missing, cannot run further!');
        process.exit(1);
    } else if (!dbName) {
        logger.fatal('Database name is missing, cannot run further!');
        process.exit(1);
    } else {
        logger.info(`Running basic-example script against entry-point '${entryPoint}' and database '${dbName}'.`);
    }
    try {
        await runner(logger, entryPoint, dbName);
    } catch (error) {
        logger.error(error);
    }
}
