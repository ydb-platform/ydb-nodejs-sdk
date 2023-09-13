"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_utils_1 = require("../test-utils");
async function readTable(session) {
    const rows = [];
    await session.streamReadTable(test_utils_1.TABLE, (result) => {
        if (result.resultSet) {
            rows.push(...test_utils_1.Row.createNativeObjects(result.resultSet));
        }
    });
    return rows;
}
describe('Bulk upsert', () => {
    let driver;
    beforeAll(async () => {
        driver = await (0, test_utils_1.initDriver)();
    });
    afterAll(async () => await (0, test_utils_1.destroyDriver)(driver));
    it('Test', async () => {
        await driver.tableClient.withSession(async (session) => {
            const initialRows = [
                new test_utils_1.Row({ id: 0, title: 'zero' }),
                new test_utils_1.Row({ id: 1, title: 'no title' }),
            ];
            const rowsToUpsert = test_utils_1.Row.asTypedCollection([
                new test_utils_1.Row({ id: 1, title: 'one' }),
                new test_utils_1.Row({ id: 2, title: 'two' }),
            ]);
            const expectedRows = [
                new test_utils_1.Row({ id: 0, title: 'zero' }),
                new test_utils_1.Row({ id: 1, title: 'one' }),
                new test_utils_1.Row({ id: 2, title: 'two' }),
            ];
            await (0, test_utils_1.createTable)(session);
            await (0, test_utils_1.fillTableWithData)(session, initialRows);
            await session.bulkUpsert(test_utils_1.TABLE, rowsToUpsert);
            const actualRows = await readTable(session);
            expect(expectedRows).toEqual(actualRows);
        });
    });
});
