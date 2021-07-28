import {getLogger, Logger} from 'ydb-sdk';
import yargs from 'yargs';


export interface Runner {
    (logger: Logger, endpoint: string): Promise<void>;
}

export async function main(runner: Runner) {
    const args = yargs
        .usage('Usage: $0 --connectionString connectionString')
        .demandOption(['connectionString'])
        .argv;

    const connectionString = args.connectionString as string;
    const logger = getLogger();
    logger.info(`Running basic-example script against connectionString '${connectionString}'.`);

    try {
        await runner(logger, connectionString);
    } catch (error) {
        logger.error(error);
    }
}

export const SYNTAX_V1 = '--!syntax_v1';
