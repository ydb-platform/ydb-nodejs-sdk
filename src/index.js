const {getEndpoint} = require('./discovery');
const {SessionPool, TableDescription, Column} = require('./table');
const ydb = require('./types');

const DB_PATH_NAME = '/ru-prestable/home/tsufiev/mydb';
const DB_ENDPOINT = 'ydb-ru-prestable.yandex.net:2135';

async function run() {
    const endpoint = await getEndpoint(DB_ENDPOINT, DB_PATH_NAME);
    const pool = new SessionPool(endpoint);
    pool.withSession(async (session) => {
        // const response = await session.describeTable('series');
        // console.log(JSON.stringify(response, null, 2));
        try {
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
                ydb.TableDescription()
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
            )

        } catch (err) {
            console.error(err)
        }
    });
}

run();
