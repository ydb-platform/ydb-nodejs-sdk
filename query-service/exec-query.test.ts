import Driver from '../../../driver';
import {
    createTable,
    destroyDriver,
    // fillTableWithData,
    initDriver,
    // Row,
    // TABLE
} from '../../../test-utils';
// import {ReadTableSettings} from '../../../table';
// import {TypedValues, TypedData} from '../../../types';
import {QuerySession} from "../../../query/query-session";

// async function execQuery(session: QuerySession): Promise<TypedData[]> {
//     const rows: TypedData[] = [];
//
//     await session.streamReadTable(TABLE, (result) => {
//         if (result.resultSet) {
//             rows.push(...Row.createNativeObjects(result.resultSet));
//         }
//     }, settings);
//
//     return rows;
// }

describe('Query service', () => {
    let driver: Driver;

    beforeAll(async () => {
        driver = await initDriver();
    });

    afterAll(async () => await destroyDriver(driver));

    it('Test', async () => {
        await driver.tableClient.withSession(async (session) => {
            // const expectedRows = [
            //     new Row({id: 1, title: 'one'}),
            //     new Row({id: 2, title: 'two'}),
            // ];

            await createTable(session);

            // TODO: Create few tables

            // TODO: Make quries with few datasets

            // await fillTableWithData(session, expectedRows);

            /*const res =*/ await driver.queryClient.do({
                cb: async (session: QuerySession) => {
                    console.info(1000, session);
                    // session.beginTransaction(),
                    // TODO: query -> array
                    return '';
                },
            });


            // {
            //     const rows = await execQuery(session, new ReadTableSettings());
            //     expect(rows).toEqual(expectedRows);
            // }
            //
            // {
            //     const rows = await readTable(session, new ReadTableSettings().withKeyRange({
            //         greaterOrEqual: TypedValues.tuple(TypedValues.optional(TypedValues.uint64(1))),
            //         lessOrEqual: TypedValues.tuple(TypedValues.optional(TypedValues.uint64(2))),
            //     }));
            //
            //     expect(rows).toEqual(expectedRows);
            // }
            //
            // {
            //     const rows = await readTable(session, new ReadTableSettings().withKeyRange({
            //         greater: TypedValues.tuple(TypedValues.optional(TypedValues.uint64(1))),
            //         lessOrEqual: TypedValues.tuple(TypedValues.optional(TypedValues.uint64(2))),
            //     }));
            //
            //     expect(rows).toEqual(expectedRows.slice(1));
            // }
        });
    });
});
