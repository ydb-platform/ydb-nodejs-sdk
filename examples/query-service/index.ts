process.env.YDB_SDK_PRETTY_LOGS = '1';

import {
    Driver,
    getCredentialsFromEnv,
    Logger,
    TypedValues,
} from 'ydb-sdk';
import {Row} from './data-helpers';
import {main} from '../utils';

const TABLE = 'table';

async function createTestTable(driver: Driver) {
    await driver.queryClient.do({
        fn: async (session) => {
            await session.execute({
                text: `
                    DROP TABLE IF EXISTS ${TABLE};

                    CREATE TABLE ${TABLE}
                    (
                        id    UInt64,
                        title Utf8,
                        time  Timestamp,
                        PRIMARY KEY (id)
                    );`,
            });
        }
    });
}

async function insert(driver: Driver) {
    await driver.queryClient.do({
        fn: async (session) => {
            await session.execute({
                parameters: {
                    '$id1': TypedValues.uint64(1),
                    '$title1': TypedValues.text('Some title1'),
                    '$id2': TypedValues.uint64(2),
                    '$title2': TypedValues.text('Some title2'),
                    '$timestamp': TypedValues.timestamp(new Date()),
                },
                text: `
                    INSERT INTO ${TABLE} (id, title, time)
                    VALUES ($id1, $title1, $timestamp);
                    INSERT INTO ${TABLE} (id, title, time)
                    VALUES ($id2, $title2, $timestamp);`,
            });
        }
    });
    return 2;
}

async function select(driver: Driver) {
    const res = await driver.queryClient.do({
        fn: async (session) => {
            const res = await session.execute({
                text: `
                    SELECT *
                    FROM ${TABLE};
                    SELECT * -- double
                    FROM ${TABLE};        `
            });
            let rowCount = 0;
            for await (const resultSet of res.resultSets) {
                console.info(`ResultSet index: ${resultSet.index}`)
                for await (const row of resultSet.rows) {
                    rowCount++;
                    console.info(`row: ${row}`);
                }
            }
            return rowCount;
        }
    });
    console.info(`rowCount: ${res}`);
}

async function typedSelect(driver: Driver) {
    const res = await driver.queryClient.do({
        fn: async (session) => {
            const res = await session.execute({
                text: `
                    SELECT *
                    FROM ${TABLE};
                    SELECT * -- double
                    FROM ${TABLE};        `
            });
            let rowCount = 0;
            for await (const resultSet of res.resultSets) {
                console.info(`ResultSet index: ${resultSet.index}`)
                for await (const row of resultSet.typedRows(Row)) {
                    rowCount++;
                    console.info(`row: ${row}`);
                }
            }
            return rowCount;
        }
    });
    console.info(`rowCount: ${res}`);
}

async function bulkUpsert(driver: Driver) {
    await driver.queryClient.do({
        fn: async (session) => {
            function* dataGenerator(rowsCount: number) {
                for (let id = 1; id <= rowsCount; id++)
                    yield new Row({
                        id,
                        rowTitle: `title_${id}`,
                        time: new Date(),
                    })
            }

            await session.execute({
                text: `
                UPSERT INTO ${TABLE} (id, title, time)
                SELECT id, title, time FROM AS_TABLE($table)`,
                parameters: {
                    '$table': Row.asTypedCollection([...dataGenerator(20)]),
                }
            });
        },
    });
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

    createTestTable(driver);
    insert(driver);
    select(driver);
    bulkUpsert(driver);
    typedSelect(driver);

    // transactions

    await driver.destroy();
}

main(run);
