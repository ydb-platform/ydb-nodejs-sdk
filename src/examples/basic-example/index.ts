import fs from 'fs';
import pino, {Logger} from 'pino';

import Driver from '../../driver';
import {Session, SessionPool, TableDescription, Column} from "../../table";
import {Ydb} from "../../../proto/bundle";
import {Series, getSeriesData, getSeasonsData, getEpisodesData} from './data-helpers';
import {IAuthService, TokenAuthService, IamAuthService} from "../../credentials";
import {ISslCredentials} from "../../utils";


const DB_PATH_NAME = '/ru-prestable/home/tsufiev/mydb';
const DB_ENTRYPOINT = 'ydb-ru-prestable.yandex.net:2135';
// const DB_PATH_NAME = '/ru-central1/b1g8mc90m9q5r3vg7h9f/etn02t35ge93lvovo64l';
// const DB_ENTRYPOINT = 'lb.etn02t35ge93lvovo64l.ydb.mdb.yandexcloud.net:2135';

const SERIES_TABLE = 'series';
const SEASONS_TABLE = 'seasons';
const EPISODES_TABLE = 'episodes';

async function createTables(session: Session) {
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

async function fillTablesWithData(tablePathPrefix: string, session: Session, logger: Logger) {
    logger.info('Preparing query...');
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

REPLACE INTO ${SERIES_TABLE}
SELECT
    series_id,
    title,
    series_info,
    CAST(release_date as Date) as release_date 
FROM AS_TABLE($seriesData);

REPLACE INTO ${SEASONS_TABLE}
SELECT
    series_id,
    season_id,
    title,
    CAST(first_aired as Date) as first_aired,
    CAST(last_aired as Date) as last_aired
FROM AS_TABLE($seasonsData);

REPLACE INTO ${EPISODES_TABLE}
SELECT
    series_id,
    season_id,
    episode_id,
    title,
    CAST(air_date as Date) as air_date
FROM AS_TABLE($episodesData);`;
    const preparedQuery = await session.prepareQuery(query);
    logger.info('Query has been prepared, executing...');
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
FROM ${SERIES_TABLE}
WHERE series_id = 1;`;
    const {resultSets} = await session.executeQuery(query);
    return Series.createNativeObjects(resultSets[0]);
}

function getCredentialsFromEnv(): IAuthService {
    if (process.env.YDB_TOKEN) {
        const token = fs.readFileSync(process.env.YDB_TOKEN).toString().trim();
        return new TokenAuthService(token);
    }

    if (process.env.SA_ID) {
        const privateKey = fs.readFileSync(process.env.SA_PRIVATE_KEY_FILE || '');
        const rootCertsFile = process.env.YDB_SSL_ROOT_CERTIFICATES_FILE || '';
        const sslCredentials: ISslCredentials = {};
        if (rootCertsFile) {
            sslCredentials.rootCertificates = fs.readFileSync(rootCertsFile);
        }
        return new IamAuthService({
            sslCredentials,
            iamCredentials: {
                iamEndpoint: process.env.SA_ENDPOINT || 'iam.api.cloud.yandex.net:443',
                serviceAccountId: process.env.SA_ID,
                accessKeyId: process.env.SA_ACCESS_KEY_ID || '',
                privateKey
            }
        });
    }

    throw new Error('Either YDB_TOKEN or SA_ID environment variable should be set!');
}

async function run(logger: Logger) {
    const authService = getCredentialsFromEnv();
    logger.info('Driver initializing...');
    const driver = new Driver(DB_ENTRYPOINT, DB_PATH_NAME, authService, logger);
    await driver.ready(5000);
    const pool = new SessionPool(driver);
    await pool.withSession(async (session) => {
        try {
            await session.dropTable(SERIES_TABLE);
            await session.dropTable(EPISODES_TABLE);
            await session.dropTable(SEASONS_TABLE);
            logger.info('Creating tables...');
            await createTables(session);
            logger.info('Tables have been created, inserting data...');
            await fillTablesWithData(DB_PATH_NAME, session, logger);
            logger.info('The data has been inserted');
        } catch (err) {
            logger.error(err);
            throw err;
        }
    });
    logger.info('Making a simple select...');
    await pool.withSession(async (session) => {
        try {
            const result = await selectSimple(DB_PATH_NAME, session);
            logger.info('selectSimple result:', result);
        } catch (err) {
            logger.error(err);
            throw err;
        }
    });
    await pool.destroy();
    await driver.destroy();
}

async function main() {
    const logger = pino({level: 'debug'});
    try {
        await run(logger);
    } catch (error) {
        logger.error(error);
    }
}

main();
