import {getLogger, Logger, parseConnectionString} from 'ydb-sdk';
import yargs from 'yargs';


export interface Runner {
    (logger: Logger, entryPoint: string, dbName: string, cliParams?: any): Promise<void>;
}

export interface Option {
    key: string;
    name: string;
    description: string;
}

export async function main(runner: Runner, options?: Option[]) {
    const optionsUsage = options && options.length > 0 ? options.map((option) => ` --${option.name}`).join('') : '';

    const argsBuilder = yargs
        .usage(`Usage: $0 (--db <database> --endpoint <endpoint> or --connection-string <connection_string>)${optionsUsage}`);

    argsBuilder.options({
       'db': { describe: 'YDB database name', type: 'string'},
       'endpoint': {describe: 'YDB database endpoint', type: 'string'},
       'connection-string': {describe: 'YDB connection string', type: 'string'},
    });

    options?.forEach((option) => {
       argsBuilder.option(option.name, {
           describe: option.description,
           type: 'string',
           demandOption: true,
       });
    });

    const args = argsBuilder.argv;

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
        endpoint = endpointParam;
        db = dbParam;
    } else {
        throw new Error('Either --connection-string <connection_string> or --db <database> --endpoint <endpoint> arguments are required');
    }

    const cliParams = {} as any;
    options?.forEach((option) => {
        cliParams[option.key] = args[option.key] as string;
    });

    const logger = getLogger();
    logger.info(`Running basic-example script against endpoint '${endpoint}' and database '${db}'.`);

    try {
        await runner(logger, endpoint, db, cliParams);
    } catch (error) {
        logger.error(error);
    }
}

export const SYNTAX_V1 = '--!syntax_v1';
