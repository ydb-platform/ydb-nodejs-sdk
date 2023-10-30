import { initDriver, destroyDriver } from '../../test-utils';

describe('Connection', () => {
    it('Test GRPC connection', async () => {
        const driver = await initDriver({ endpoint: 'grpc://localhost:2136' });

        await driver.tableClient.withSession(async (session) => {
            await session.executeQuery('SELECT 1');
        });
        await destroyDriver(driver);
    });

    it('Test GRPCS connection', async () => {
        const driver = await initDriver();

        await driver.tableClient.withSession(async (session) => {
            await session.executeQuery('SELECT 1');
        });
        await destroyDriver(driver);
    });
});
