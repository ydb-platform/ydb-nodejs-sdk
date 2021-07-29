import {getLogger, Logger, parseConnectionString} from 'ydb-sdk';
import yargs from 'yargs';


export interface Runner {
    (logger: Logger, entryPoint: string, dbName: string): Promise<void>;
}

export async function main(runner: Runner) {
    const args = yargs
        .usage('Usage: $0 --db <database> --endpoint <endpoint> or --connection-string <connection_string>')
        .argv;

    const endpointParam = args.endpoint as string;
    const dbParam = args.db as string;
    const connectionStringParam = args.connectionString as string;

    let endpoint;
    let db;
    if (connectionStringParam) {
        const parsedConnectionString = parseConnectionString(connectionStringParam);
        endpoint = parsedConnectionString.endpoint;
        db = parsedConnectionString.database;
    } else if (endpointParam && dbParam) {
        endpoint = args.endpoint as string;
        db = args.db as string;
    } else {
        throw new Error('Either --connection-string <connection_string> or --db <database> --endpoint <endpoint> arguments are required');
    }

    const logger = getLogger();
    logger.info(`Running basic-example script against endpoint '${endpoint}' and database '${db}'.`);

    try {
        await runner(logger, endpoint, db);
    } catch (error) {
        logger.error(error);
    }
}

export const SYNTAX_V1 = '--!syntax_v1';
