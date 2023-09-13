"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_utils_1 = require("../test-utils");
describe('Connection', () => {
    it('Test GRPC connection', async () => {
        let driver = await (0, test_utils_1.initDriver)({ endpoint: 'grpc://localhost:2136' });
        await driver.tableClient.withSession(async (session) => {
            await session.executeQuery('SELECT 1');
        });
        await (0, test_utils_1.destroyDriver)(driver);
    });
    it('Test GRPCS connection', async () => {
        let driver = await (0, test_utils_1.initDriver)();
        await driver.tableClient.withSession(async (session) => {
            await session.executeQuery('SELECT 1');
        });
        await (0, test_utils_1.destroyDriver)(driver);
    });
});
