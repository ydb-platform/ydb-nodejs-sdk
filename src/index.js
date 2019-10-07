const {getEndpoint} = require('./discovery');
const {SessionPool, TableDescription, Column} = require('./table');
const ydb = require('./types');
const {getSeriesData, getSeasonsData, getEpisodesData} = require('./data-helpers');
const _ = require('lodash');

const DB_PATH_NAME = '/ru-prestable/home/tsufiev/mydb';
const DB_ENDPOINT = 'ydb-ru-prestable.yandex.net:2135';


async function createTables(session) {
    // await session.dropTable('series1')
    await session.createTable(
        'series1',
        new TableDescription()
            .withColumn(new Column(
                'series_id',
                new ydb.Type(new ydb.OptionalType(new ydb.Type(ydb.PrimitiveType.Uint64)))
            ))
            .withColumn(new Column(
                'title',
                new ydb.Type(new ydb.OptionalType(new ydb.Type(ydb.PrimitiveType.Utf8)))
            ))
            .withColumn(new Column(
                'series_info',
                new ydb.Type(new ydb.OptionalType(new ydb.Type(ydb.PrimitiveType.Utf8)))
            ))
            .withColumn(new Column(
                'release_date',
                new ydb.Type(new ydb.OptionalType(new ydb.Type(ydb.PrimitiveType.Uint64)))
            ))
            .withPrimaryKey('series_id')
    );
    await session.createTable(
        'seasons1',
        new TableDescription()
            .withColumn(new Column(
                'series_id',
                new ydb.Type(new ydb.OptionalType(new ydb.Type(ydb.PrimitiveType.Uint64)))
            ))
            .withColumn(new Column(
                'season_id',
                new ydb.Type(new ydb.OptionalType(new ydb.Type(ydb.PrimitiveType.Uint64)))
            ))
            .withColumn(new Column(
                'title',
                new ydb.Type(new ydb.OptionalType(new ydb.Type(ydb.PrimitiveType.Utf8)))
            ))
            .withColumn(new Column(
                'first_aired',
                new ydb.Type(new ydb.OptionalType(new ydb.Type(ydb.PrimitiveType.Uint64)))
            ))
            .withColumn(new Column(
                'last_aired',
                new ydb.Type(new ydb.OptionalType(new ydb.Type(ydb.PrimitiveType.Uint64)))
            ))
            .withPrimaryKeys('series_id', 'season_id')
    );

    session.createTable(
        'episodes1',
        new TableDescription()
            .withColumn(new Column(
                'series_id',
                new ydb.Type(new ydb.OptionalType(new ydb.Type(ydb.PrimitiveType.Uint64)))
            ))
            .withColumn(new Column(
                'season_id',
                new ydb.Type(new ydb.OptionalType(new ydb.Type(ydb.PrimitiveType.Uint64)))
            ))
            .withColumn(new Column(
                'episode_id',
                new ydb.Type(new ydb.OptionalType(new ydb.Type(ydb.PrimitiveType.Uint64)))
            ))
            .withColumn(new Column(
                'title',
                new ydb.Type(new ydb.OptionalType(new ydb.Type(ydb.PrimitiveType.Utf8)))
            ))
            .withColumn(new Column(
                'air_date',
                new ydb.Type(new ydb.OptionalType(new ydb.Type(ydb.PrimitiveType.Uint64)))
            ))
            .withPrimaryKeys('series_id', 'season_id', 'episode_id')
    );
}

/*
DECLARE $seasonsData AS "List<Struct<
    series_id: Uint64,
    season_id: Uint64,
    title: Utf8,
    first_aired: Date,
    last_aired: Date>>";

DECLARE $episodesData AS "List<Struct<
    series_id: Uint64,
    season_id: Uint64,
    episode_id: Uint64,
    title: Utf8,
    air_date: Date>>";

REPLACE INTO seasons1
SELECT
    series_id,
    season_id,
    title,
    CAST(first_aired AS Uint16) AS first_aired,
    CAST(last_aired AS Uint16) AS last_aired
FROM AS_TABLE($seasonsData);

REPLACE INTO episodes1
SELECT
    series_id,
    season_id,
    episode_id,
    title,
    CAST(air_date AS Uint16) AS air_date
FROM AS_TABLE($episodesData);
 */
async function fillTablesWithData(tablePathPrefix, session) {
    console.log('Preparing query...')
    const query1 = `
PRAGMA TablePathPrefix("${tablePathPrefix}");

DECLARE $seriesData AS "List<Struct<
    series_id: Uint64,
    title: Utf8,
    series_info: Utf8,
    release_date: Date>>";

REPLACE INTO series1
SELECT
    series_id,
    title,
    series_info,
    CAST(release_date AS Uint32) AS release_date
FROM AS_TABLE($seriesData);
`;
    const query2 = `
PRAGMA TablePathPrefix("${tablePathPrefix}");

DECLARE $seriesId AS Uint64;
DECLARE $title AS Utf8;
DECLARE $seriesInfo AS Utf8;
DECLARE $releaseDate AS Date;

UPSERT INTO series1 (series_id, title, series_info, release_date) VALUES
($seriesId, $title, $seriesInfo, CAST($releaseDate as Uint64));
`;
    console.log(query1)
    const preparedQuery = await session.prepareQuery(query1);
    console.log('Query has been prepared, executing...');
    await session.executeQuery(preparedQuery, {
        '$seriesData': getSeriesData()/*,
        '$seasonsData': getSeasonsData(),
        '$episodesData': getEpisodesData(),
        */
    });
/*
    await session.executeQuery(preparedQuery, wrapParams({
        '$seriesId': 3,
        '$title': 'IT Crowd',
        '$seriesInfo': 'The IT Crowd is a British sitcom produced by Channel 4, written by Graham Linehan, produced ' +
            'by Ash Atalla and starring Chris O\'Dowd, Richard Ayoade, Katherine Parkinson, and Matt Berry.',
        '$releaseDate': '2006-02-03'
    }));
    await session.executeQuery(preparedQuery, wrapParams({
        '$seriesId': 4,
        '$title': 'Silicon Valley',
        '$seriesInfo': 'Silicon Valley is an American comedy television series created by Mike Judge, John ' +
            'Altschuler and Dave Krinsky. The series focuses on five young men who founded a startup company in ' +
            'Silicon Valley.',
        '$releaseDate': '2014-04-06'
    }));
 */
}

function wrapParams(params) {
    return _.mapValues(params, (value) => {
        if (_.isNumber(value)) {
            return {
                type: {type_id: ydb.PrimitiveType.Uint64},
                value: {uint64_value: value}
            };
        } else {
            return {
                type: {type_id: ydb.PrimitiveType.Utf8},
                value: {text_value: value}
            };
        }
    });
}

async function run() {
    const endpoint = await getEndpoint(DB_ENDPOINT, DB_PATH_NAME);
    const pool = new SessionPool(endpoint);
    pool.withSession(async (session) => {
        // const response = await session.describeTable('series');
        // console.log(JSON.stringify(response, null, 2));
        try {
            // await session.dropTable('series1');
            // await session.dropTable('episodes1')
            // await session.dropTable('seasons1')
            // return;
            console.log('Creating tables...');
            await createTables(session);
            console.log('Tables have been created, inserting data...');
            await fillTablesWithData(DB_PATH_NAME, session);
            console.log('The data has been inserted')
        } catch (err) {
            console.error('Caught error', err, err.issues[0].issues)
        }
    });
}

run();
