process.env.YDB_SDK_PRETTY_LOGS = '1';

import {
    Column,
    Driver,
    Logger,
    Session,
    TableDescription,
    withRetries,
    Ydb
} from 'ydb-sdk';
import {Episode, getEpisodesData, getSeasonsData, getSeriesData, Series} from './data-helpers';
import {main, SYNTAX_V1} from '../utils';


const SERIES_TABLE = 'series';
const SEASONS_TABLE = 'seasons';
const EPISODES_TABLE = 'episodes';

async function createTables(session: Session, logger: Logger) {
    logger.info('Dropping old tables...');
    await session.dropTable(SERIES_TABLE);
    await session.dropTable(EPISODES_TABLE);
    await session.dropTable(SEASONS_TABLE);

    logger.info('Creating tables...');
    await session.createTable(
        SERIES_TABLE,
        new TableDescription()
            .withColumn(new Column(
                'series_id',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UINT64}}})
            ))
            .withColumn(new Column(
                'title',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UTF8}}})
            ))
            .withColumn(new Column(
                'series_info',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UTF8}}})
            ))
            .withColumn(new Column(
                'release_date',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.DATE}}})
            ))
            .withPrimaryKey('series_id')
    );

    await session.createTable(
        SEASONS_TABLE,
        new TableDescription()
            .withColumn(new Column(
                'series_id',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UINT64}}})
            ))
            .withColumn(new Column(
                'season_id',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UINT64}}})
            ))
            .withColumn(new Column(
                'title',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UTF8}}})
            ))
            .withColumn(new Column(
                'first_aired',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.DATE}}})
            ))
            .withColumn(new Column(
                'last_aired',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.DATE}}})
            ))
            .withPrimaryKeys('series_id', 'season_id')
    );

    await session.createTable(
        EPISODES_TABLE,
        new TableDescription()
            .withColumn(new Column(
                'series_id',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UINT64}}})
            ))
            .withColumn(new Column(
                'season_id',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UINT64}}})
            ))
            .withColumn(new Column(
                'episode_id',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UINT64}}})
            ))
            .withColumn(new Column(
                'title',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UTF8}}})
            ))
            .withColumn(new Column(
                'air_date',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.DATE}}})
            ))
            .withPrimaryKeys('series_id', 'season_id', 'episode_id')
    );
}

async function describeTable(session: Session, tableName: string, logger: Logger) {
    logger.info(`Describing table: ${tableName}`);
    const result = await session.describeTable(tableName);
    for (const column of result.columns) {
        logger.info(`Column name '${column.name}' has type ${JSON.stringify(column.type)}`);
    }
}

async function fillTablesWithData(tablePathPrefix: string, session: Session, logger: Logger) {
    const query = `
${SYNTAX_V1}
PRAGMA TablePathPrefix("${tablePathPrefix}");

DECLARE $seriesData AS List<Struct<
    series_id: Uint64,
    title: Utf8,
    series_info: Utf8,
    release_date: Date>>;
DECLARE $seasonsData AS List<Struct<
    series_id: Uint64,
    season_id: Uint64,
    title: Utf8,
    first_aired: Date,
    last_aired: Date>>;
DECLARE $episodesData AS List<Struct<
    series_id: Uint64,
    season_id: Uint64,
    episode_id: Uint64,
    title: Utf8,
    air_date: Date>>;

REPLACE INTO ${SERIES_TABLE}
SELECT
    series_id,
    title,
    series_info,
    release_date
FROM AS_TABLE($seriesData);

REPLACE INTO ${SEASONS_TABLE}
SELECT
    series_id,
    season_id,
    title,
    first_aired,
    last_aired
FROM AS_TABLE($seasonsData);

REPLACE INTO ${EPISODES_TABLE}
SELECT
    series_id,
    season_id,
    episode_id,
    title,
    air_date
FROM AS_TABLE($episodesData);`;
    async function fillTable() {
        logger.info('Inserting data to tables, preparing query...');
        const preparedQuery = await session.prepareQuery(query);
        logger.info('Query has been prepared, executing...');
        await session.executeQuery(preparedQuery, {
            '$seriesData': getSeriesData(),
            '$seasonsData': getSeasonsData(),
            '$episodesData': getEpisodesData()
        });
    }
    await withRetries(fillTable);
}

async function selectSimple(tablePathPrefix: string, session: Session, logger: Logger): Promise<void> {
    const query = `
${SYNTAX_V1}
PRAGMA TablePathPrefix("${tablePathPrefix}");
SELECT series_id,
       title,
       release_date
FROM ${SERIES_TABLE}
WHERE series_id = 1;`;
    logger.info('Making a simple select...');
    const {resultSets} = await session.executeQuery(query);
    const result = Series.createNativeObjects(resultSets[0]);
    logger.info(`selectSimple result: ${JSON.stringify(result, null, 2)}`);
}

async function upsertSimple(tablePathPrefix: string, session: Session, logger: Logger): Promise<void> {
    const query = `
${SYNTAX_V1}
PRAGMA TablePathPrefix("${tablePathPrefix}");
UPSERT INTO ${EPISODES_TABLE} (series_id, season_id, episode_id, title) VALUES
(2, 6, 1, "TBD");`;
    logger.info('Making an upsert...');
    await session.executeQuery(query);
    logger.info('Upsert completed.')
}

type ThreeIds = [number, number, number];

async function selectPrepared(tablePathPrefix: string, session: Session, data: ThreeIds[], logger: Logger): Promise<void> {
    const query = `
    ${SYNTAX_V1}
    PRAGMA TablePathPrefix("${tablePathPrefix}");

    DECLARE $seriesId AS Uint64;
    DECLARE $seasonId AS Uint64;
    DECLARE $episodeId AS Uint64;

    SELECT title,
           air_date
    FROM episodes
    WHERE series_id = $seriesId AND season_id = $seasonId AND episode_id = $episodeId;`;
    async function select() {
        logger.info('Preparing query...');
        const preparedQuery = await session.prepareQuery(query);
        logger.info('Selecting prepared query...');
        for (const [seriesId, seasonId, episodeId] of data) {
            const episode = new Episode({seriesId, seasonId, episodeId, title: '', airDate: new Date()});
            const {resultSets} = await session.executeQuery(preparedQuery, {
                '$seriesId': episode.getTypedValue('seriesId'),
                '$seasonId': episode.getTypedValue('seasonId'),
                '$episodeId': episode.getTypedValue('episodeId')
            });
            const result = Series.createNativeObjects(resultSets[0]);
            logger.info(`Select prepared query ${JSON.stringify(result, null, 2)}`);
        }
    }
    await withRetries(select);
}

async function explicitTcl(tablePathPrefix: string, session: Session, ids: ThreeIds, logger: Logger) {
    const query = `
    ${SYNTAX_V1}
    PRAGMA TablePathPrefix("${tablePathPrefix}");

    DECLARE $seriesId AS Uint64;
    DECLARE $seasonId AS Uint64;
    DECLARE $episodeId AS Uint64;

    UPDATE episodes
    SET air_date = CurrentUtcDate()
    WHERE series_id = $seriesId AND season_id = $seasonId AND episode_id = $episodeId;`;
    async function update() {
        logger.info('Running prepared query with explicit transaction control...');
        const preparedQuery = await session.prepareQuery(query);
        const txMeta = await session.beginTransaction({serializableReadWrite: {}});
        const [seriesId, seasonId, episodeId] = ids;
        const episode = new Episode({seriesId, seasonId, episodeId, title: '', airDate: new Date()});
        const params = {
            '$seriesId': episode.getTypedValue('seriesId'),
            '$seasonId': episode.getTypedValue('seasonId'),
            '$episodeId': episode.getTypedValue('episodeId')
        };
        const txId = txMeta.id as string;
        logger.info(`Executing query with txId ${txId}.`);
        await session.executeQuery(preparedQuery, params, {txId});
        await session.commitTransaction({txId});
        logger.info(`TxId ${txId} committed.`);
    }
    await withRetries(update);
}

async function run(logger: Logger, endpoint: string) {
    logger.debug('Driver initializing...');
    const driver = new Driver(endpoint);
    const dbName = driver.database;
    const timeout = 10000;
    if (!await driver.ready(timeout)) {
        logger.fatal(`Driver has not become ready in ${timeout}ms!`);
        process.exit(1);
    }
    await driver.tableClient.withSession(async (session) => {
        await createTables(session, logger);
        await describeTable(session, 'series', logger);
        await fillTablesWithData(dbName, session, logger);
    });
    await driver.tableClient.withSession(async (session) => {
        await selectSimple(dbName, session, logger);
        await upsertSimple(dbName, session, logger);

        await selectPrepared(dbName, session, [[2, 3, 7], [2, 3, 8]], logger);

        await explicitTcl(dbName, session, [2, 6, 1], logger);
        await selectPrepared(dbName, session, [[2, 6, 1]], logger);
    });
    await driver.destroy();
}

main(run);
