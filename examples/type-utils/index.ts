process.env.YDB_SDK_PRETTY_LOGS = '1';

import {
    Column,
    Driver,
    getCredentialsFromEnv,
    Logger,
    Session,
    TableDescription,
    Types,
    withRetries,
} from 'ydb-sdk';
import {getSeriesData, Series} from './data-helpers';
import {main, SYNTAX_V1} from '../utils';


const SERIES_TABLE = 'series';

async function createTables(session: Session, logger: Logger) {
    logger.info('Dropping old tables...');
    await session.dropTable(SERIES_TABLE);

    logger.info('Creating tables...');
    await session.createTable(
        SERIES_TABLE,
        new TableDescription()
            .withColumn(new Column(
                'series_id',
                Types.optional(Types.UINT64),
            ))
            .withColumn(new Column(
                'title',
                Types.optional(Types.UTF8),
            ))
            .withColumn(new Column(
                'series_info',
                Types.optional(Types.UTF8),
            ))
            .withColumn(new Column(
                'release_date',
                Types.optional(Types.DATE),
            ))
            .withPrimaryKey('series_id')
    );
}

async function fillTablesWithData(session: Session, logger: Logger) {
    const query = `
${SYNTAX_V1}
DECLARE $seriesData AS List<Struct<
    series_id: Uint64,
    title: Utf8,
    series_info: Utf8,
    release_date: Date>>;

REPLACE INTO ${SERIES_TABLE}
SELECT
    series_id,
    title,
    series_info,
    release_date
FROM AS_TABLE($seriesData);
`;
    async function fillTable() {
        logger.info('Inserting data to tables, preparing query...');
        const preparedQuery = await session.prepareQuery(query);
        logger.info('Query has been prepared, executing...');
        await session.executeQuery(preparedQuery, {
            '$seriesData': getSeriesData()
        });
    }
    await withRetries(fillTable);
}

async function selectSimple(session: Session, logger: Logger): Promise<void> {
    const query = `
${SYNTAX_V1}
SELECT series_id,
       title,
       series_info,
       release_date
FROM ${SERIES_TABLE}
WHERE series_id = 1;`;
    logger.info('Making a simple select...');
    const {resultSets} = await session.executeQuery(query);
    logger.info(JSON.stringify(resultSets, null, 2))
    const result = Series.createNativeObjects(resultSets[0]);
    logger.info(`selectSimple result: ${JSON.stringify(result, null, 2)}`);
}

async function run(logger: Logger, endpoint: string, database: string) {
    const authService = getCredentialsFromEnv();
    logger.debug('Driver initializing...');
    const driver = new Driver({endpoint, database, authService});
    const timeout = 10000;
    if (!await driver.ready(timeout)) {
        logger.fatal(`Driver has not become ready in ${timeout}ms!`);
        process.exit(1);
    }
    await driver.tableClient.withSession(async (session) => {
        await createTables(session, logger);
        await fillTablesWithData(session, logger);
    });
    await driver.tableClient.withSession(async (session) => {
        await selectSimple(session, logger);
    });
    await driver.destroy();
}

main(run);
