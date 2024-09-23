if (process.env.TEST_ENVIRONMENT === 'dev') require('dotenv').config();
import Driver from '../../../driver';
import {TypedData} from '../../../types';
import {TableSession} from "../../../table";
import {Row, initDriver, destroyDriver, createTable, fillTableWithData, TABLE} from "../../../utils/test";

async function executeScanQuery(session: TableSession): Promise<TypedData[]> {
    const query = `SELECT * FROM ${TABLE};`;

    const rows: TypedData[] = [];

    await session.streamExecuteScanQuery(query, (result) => {
        if (result.resultSet) {
            rows.push(...Row.createNativeObjects(result.resultSet));
        }
    });

    return rows;
}

describe('Scan query', () => {
    let driver: Driver;

    beforeAll(async () => {
        driver = await initDriver();
    });

    afterAll(async () => await destroyDriver(driver));

    it('Test', async () => {
        await driver.tableClient.withSession(async (session) => {
            const expectedRows = [
                new Row({id: 1, title: 'one'}),
                new Row({id: 2, title: 'two'}),
            ];

            await createTable(session);
            await fillTableWithData(session, expectedRows);

            const rows = await executeScanQuery(session);

            expect(rows).toEqual(expectedRows);
        });
    });
});
