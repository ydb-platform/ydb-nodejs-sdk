import Driver from '../driver';
import {initDriver, destroyDriver} from '../test-utils';

describe('Connection', () => {
    let driver: Driver;

    beforeAll(async () => {
       driver = await initDriver();
    });

    afterAll(() => destroyDriver(driver));

    it('Test connection', async () => {
        await driver.tableClient.withSession(async (session) => {
            await session.executeQuery('SELECT 1');
        });
    });
});
