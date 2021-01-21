import {getLogger, Logger} from 'ydb-sdk';
import yargs from 'yargs';


export interface Runner {
    (logger: Logger, entryPoint: string, dbName: string): Promise<void>;
}

export async function main(runner: Runner) {
    const args = yargs
        .usage('Usage: $0 --db database --endpoint endpoint')
        .demandOption(['db', 'endpoint'])
        .argv;

    const endpoint = args.endpoint as string;
    const db = args.db as string;
    const logger = getLogger();
    logger.info(`Running basic-example script against endpoint '${endpoint}' and database '${db}'.`);

    try {
        await runner(logger, endpoint, db);
    } catch (error) {
        logger.error(error);
    }
}

export const SYNTAX_V1 = '--!syntax_v1';
