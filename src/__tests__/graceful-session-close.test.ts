import http from 'http';
import Driver from "../driver";
import {destroyDriver, initDriver} from "../test-utils";
import {sleep} from "../utils";

const SHUTDOWN_URL = process.env.YDB_SHUTDOWN_URL || 'http://localhost:8765/actors/kqp_proxy?force_shutdown=all';

describe('Graceful session close', () => {
    let driver: Driver;
    afterAll(async () => await destroyDriver(driver));

    it('All sessions should be closed from the server side and be deleted upon return to the pool', async () => {
        const PREALLOCATED_SESSIONS = 10;
        driver = await initDriver({poolSettings: {
            maxLimit: PREALLOCATED_SESSIONS,
            minLimit: PREALLOCATED_SESSIONS
        }});
        // give time for the asynchronous session creation to finish before shutting down all existing sessions
        await sleep(100)
        await http.get(SHUTDOWN_URL);
        let sessionsToClose = 0;
        const promises = [];
        for (let i = 0; i < 100; i++) {
            const promise = driver.tableClient.withSessionRetry(async (session) => {
                await session.executeQuery('SELECT Random(1);');

                if (session.isClosing()) {
                    sessionsToClose++;
                }
            });
            promises.push(promise);
        }
        await Promise.all(promises);
        expect(sessionsToClose).toBeGreaterThanOrEqual(PREALLOCATED_SESSIONS);
    });

});
