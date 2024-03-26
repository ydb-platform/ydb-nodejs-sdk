process.env.YDB_SDK_PRETTY_LOGS = '1';

import {Driver, getCredentialsFromEnv, Logger, TypedValues, RowType} from 'ydb-sdk';
import {Row} from './data-helpers';
import {main} from '../utils';

const TABLE = 'query_service_table';

async function createTestTable(driver: Driver) {
    await driver.queryClient.do({
        fn: async (session) => {
            await session.execute({
                text: `
                    DROP TABLE IF EXISTS ${TABLE};

                    CREATE TABLE ${TABLE}
                    (
                        id    UInt64,
                        rowTitle Utf8,
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
                    INSERT INTO ${TABLE} (id, rowTitle, time)
                    VALUES ($id1, $title1, $timestamp);
                    INSERT INTO ${TABLE} (id, rowTitle, time)
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
            let rowsCount = 0;
            for await (const resultSet of res.resultSets) {
                console.info(`ResultSet index: ${resultSet.index}`)
                for await (const row of resultSet.rows) {
                    rowsCount++;
                    console.info(`row: ${JSON.stringify(row)}`);
                }
            }
            return rowsCount;
        }
    });
    console.info(`rowCount: ${res}`);
}

async function typedSelect(driver: Driver) {
    const res = await driver.queryClient.do({
        fn: async (session) => {
            // @ts-ignore
            const res = await session.execute({
                rowMode: RowType.Ydb,
                text: `
                    SELECT *
                    FROM ${TABLE};
                    SELECT * -- double
                    FROM ${TABLE};        `
            });
            let rowsCount = 0;
            for await (const resultSet of res.resultSets) {
                console.info(`ResultSet index: ${resultSet.index}`)
                for await (const row of resultSet.typedRows(Row)) {
                    rowsCount++;
                    console.info(`row: ${JSON.stringify(row)}`);
                }
            }
            return rowsCount;
        }
    });
    console.info(`rowCount: ${res}`);
}

async function bulkUpsert(driver: Driver) {
    await driver.queryClient.do({
        fn: async (session) => {
            let arr: Row[] = [];

            for (let id = 1; id <= 20; id++)
                arr.push(new Row({
                    id,
                    rowTitle: `title_${id}`,
                    time: new Date(),
                }));

            await session.execute({
                text: `
                UPSERT INTO ${TABLE} (id, rowTitle, time)
                SELECT id, rowTitle, time FROM AS_TABLE($table)`,
                parameters: {
                    '$table': Row.asTypedCollection(arr),
                }
            });
        },
    });
}

async function run(logger: Logger, endpoint: string, database: string) {
    const authService = getCredentialsFromEnv();
    logger.info('Driver initializing...');
    const driver = new Driver({endpoint, database, authService});
    const timeout = 10000;
    if (!await driver.ready(timeout)) {
        logger.fatal(`Driver has not become ready in ${timeout}ms!`);
        process.exit(1);
    }
    await createTestTable(driver);
    await insert(driver);
    await select(driver);
    await bulkUpsert(driver);
    await typedSelect(driver);

    // TODO: Add samples for transactions  Right now, details of usage can be seen in src/__tests__/e2e/query-service/transactions.ts
    // TODO: Add samples for queryClient.doTx()  Right now, details of usage can be seen in src/__tests__/e2e/query-service/query-service-client.ts

    await driver.destroy();
}

main(run);
