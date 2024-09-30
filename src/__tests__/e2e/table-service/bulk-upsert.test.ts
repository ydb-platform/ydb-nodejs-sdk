if (process.env.TEST_ENVIRONMENT === 'dev') require('dotenv').config();
import {Ydb} from 'ydb-sdk-proto';
import Driver from '../../../driver';
import {TableSession} from "../../../table";
import {Row, initDriver, destroyDriver, createTable, fillTableWithData, TABLE} from "../../../utils/test";

if (process.env.TEST_ENVIRONMENT === 'dev') require('dotenv').config();

async function readTable(session: TableSession): Promise<Row[]> {
    const rows: Row[] = [];

    await session.streamReadTable(TABLE, (result) => {
        if (result.resultSet) {
            rows.push(...Row.createNativeObjects(result.resultSet) as Row[]);
        }
    });

    return rows;
}

describe('Bulk upsert', () => {
    let driver: Driver;

    beforeAll(async () => {
        driver = await initDriver();
    });

    afterAll(async () => await destroyDriver(driver));

    it('Test', async () => {
        await driver.tableClient.withSession(async (session) => {
            const initialRows = [
                new Row({id: 0, title: 'zero'}),
                new Row({id: 1, title: 'no rowTitle'}),
            ];

            const rowsToUpsert = Row.asTypedCollection([
                new Row({id: 1, title: 'one'}),
                new Row({id: 2, title: 'two'}),
            ]) as Ydb.TypedValue;

            const expectedRows = [
                new Row({id: 0, title: 'zero'}),
                new Row({id: 1, title: 'one'}),
                new Row({id: 2, title: 'two'}),
            ];

            await createTable(session);
            await fillTableWithData(session, initialRows);
            await session.bulkUpsert(TABLE, rowsToUpsert);
            const actualRows = await readTable(session);
            expect(expectedRows).toEqual(actualRows);
        });
    });
});
