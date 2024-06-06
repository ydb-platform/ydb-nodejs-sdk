import {initDriver, destroyDriver} from "../../utils/test";

describe('Connection', () => {
    it('Test GRPC connection', async () => {
        let driver = await initDriver({endpoint: 'grpc://localhost:2136'});
        await driver.tableClient.withSession(async (session) => {
            await session.executeQuery('SELECT 1');
        });
        await destroyDriver(driver)
    });

    it('Test GRPCS connection', async () => {
        let driver = await initDriver({endpoint: 'grpcs://localhost:2135'});
        await driver.tableClient.withSession(async (session) => {
            await session.executeQuery('SELECT 1');
        });
        await destroyDriver(driver)
    });
});
