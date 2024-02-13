import {initDriver, destroyDriver} from '../../../test-utils';

Error.stackTraceLimit = Infinity;

describe('Connection', () => {
    it('Test GRPC connection', async () => {
        let driver = await initDriver({endpoint: 'grpc://localhost:2136'});
        await driver.tableClient.withSession(async (session) => {
            await session.executeQuery('SELECT 1');
        });
        await destroyDriver(driver)
    });

    xit('Test GRPCS connection', async () => {
        let driver = await initDriver();
        await driver.tableClient.withSession(async (session) => {
            await session.executeQuery('SELECT 1');
        });
        await destroyDriver(driver)
    });
});
