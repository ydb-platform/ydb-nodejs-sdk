import Driver from '../../../driver';
import {TypedValues, TypedData} from '../../../types';
import {ReadTableSettings, TableSession} from "../../../table";
import {Row, initDriver, destroyDriver, createTable, fillTableWithData, TABLE} from "../../../utils/test";

if (process.env.TEST_ENVIRONMENT === 'dev') require('dotenv').config();

async function readTable(session: TableSession, settings: ReadTableSettings): Promise<TypedData[]> {
    const rows: TypedData[] = [];

    await session.streamReadTable(TABLE, (result) => {
        if (result.resultSet) {
            rows.push(...Row.createNativeObjects(result.resultSet));
        }
    }, settings);

    return rows;
}

describe('Read table', () => {
    let driver: Driver;

    beforeAll(async () => {
        driver = await initDriver();
    });

    afterAll(async () => await destroyDriver(driver));

    xit('Test', async () => {
        await driver.tableClient.withSessionRetry(async (session) => {
            const expectedRows = [
                new Row({id: 1, title: 'one'}),
                new Row({id: 2, title: 'two'}),
            ];

            await createTable(session);
            await fillTableWithData(session, expectedRows);

            {
                const rows = await readTable(session, new ReadTableSettings());
                expect(rows).toEqual(expectedRows);
            }

            {
                const rows = await readTable(session, new ReadTableSettings().withKeyRange({
                    greaterOrEqual: TypedValues.tuple(TypedValues.optional(TypedValues.uint64(1))),
                    lessOrEqual: TypedValues.tuple(TypedValues.optional(TypedValues.uint64(2))),
                }));

                expect(rows).toEqual(expectedRows);
            }

            {
                const rows = await readTable(session, new ReadTableSettings().withKeyRange({
                    greater: TypedValues.tuple(TypedValues.optional(TypedValues.uint64(1))),
                    lessOrEqual: TypedValues.tuple(TypedValues.optional(TypedValues.uint64(2))),
                }));

                expect(rows).toEqual(expectedRows.slice(1));
            }
        });
    });
});
