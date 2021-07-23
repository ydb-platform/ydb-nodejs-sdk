import {getLogger, Logger} from 'ydb-sdk';
import yargs from 'yargs';


export interface Runner {
    (logger: Logger, endpoint: string): Promise<void>;
}

export async function main(runner: Runner) {
    const args = yargs
        .usage('Usage: $0 --endpoint endpoint')
        .demandOption(['endpoint'])
        .argv;

    const endpoint = args.endpoint as string;
    const logger = getLogger();
    logger.info(`Running basic-example script against endpoint '${endpoint}'.`);

    try {
        await runner(logger, endpoint);
    } catch (error) {
        logger.error(error);
    }
}

export const SYNTAX_V1 = '--!syntax_v1';
