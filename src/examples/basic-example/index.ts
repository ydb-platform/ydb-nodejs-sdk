import Driver from '../../driver';
import {Session, SessionPool, TableDescription, Column} from "../../table";
import {Ydb} from "../../../proto/bundle";
import {Series, getSeriesData, getSeasonsData, getEpisodesData} from './data-helpers';


const DB_PATH_NAME = '/ru-prestable/home/tsufiev/mydb';
const DB_ENTRYPOINT = 'ydb-ru-prestable.yandex.net:2135';

async function createTables(session: Session) {
    await session.createTable(
        'series1',
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
        'seasons1',
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
        'episodes1',
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

async function fillTablesWithData(tablePathPrefix: string, session: Session) {
    console.log('Preparing query...');
    const query = `
PRAGMA TablePathPrefix("${tablePathPrefix}");

DECLARE $seriesData AS "List<Struct<
    series_id: Uint64,
    title: Utf8,
    series_info: Utf8,
    release_date: Utf8>>";
DECLARE $seasonsData AS "List<Struct<
    series_id: Uint64,
    season_id: Uint64,
    title: Utf8,
    first_aired: Utf8,
    last_aired: Utf8>>";
DECLARE $episodesData AS "List<Struct<
    series_id: Uint64,
    season_id: Uint64,
    episode_id: Uint64,
    title: Utf8,
    air_date: Utf8>>";

REPLACE INTO series1
SELECT
    series_id,
    title,
    series_info,
    CAST(release_date as Date) as release_date 
FROM AS_TABLE($seriesData);

REPLACE INTO seasons1
SELECT
    series_id,
    season_id,
    title,
    CAST(first_aired as Date) as first_aired,
    CAST(last_aired as Date) as last_aired
FROM AS_TABLE($seasonsData);

REPLACE INTO episodes1
SELECT
    series_id,
    season_id,
    episode_id,
    title,
    CAST(air_date as Date) as air_date
FROM AS_TABLE($episodesData);`;
    const preparedQuery = await session.prepareQuery(query);
    console.log('Query has been prepared, executing...');
    await session.executeQuery({id: preparedQuery.queryId}, {
        '$seriesData': getSeriesData(),
        '$seasonsData': getSeasonsData(),
        '$episodesData': getEpisodesData()
    });
}

async function selectSimple(tablePathPrefix: string, session: Session): Promise<void> {
    const query = `
PRAGMA TablePathPrefix("${tablePathPrefix}");
SELECT series_id, title, series_info, release_date
FROM series
WHERE series_id = 1;`;
    const {resultSets} = await session.executeQuery(query);
    return Series.createNativeObjects(resultSets[0]);
}

async function run() {
    const driver = new Driver(DB_ENTRYPOINT, DB_PATH_NAME);
    await driver.ready(5000);
    const pool = new SessionPool(driver);
    await pool.withSession(async (session) => {
        try {
            await session.dropTable('series1');
            await session.dropTable('episodes1');
            await session.dropTable('seasons1');
            console.log('Creating tables...');
            await createTables(session);
            console.log('Tables have been created, inserting data...');
            await fillTablesWithData(DB_PATH_NAME, session);
            console.log('The data has been inserted');
        } catch (err) {
            console.error(err);
            throw err;
        }
    });
    console.log('Making a simple select...');
    await pool.withSession(async (session) => {
        try {
            const result = await selectSimple(DB_PATH_NAME, session);
            console.log('selectSimple result:', result);
        } catch (err) {
            console.error(err);
            throw err;
        }
    });
    await pool.destroy();
    await driver.destroy();
}

run();

