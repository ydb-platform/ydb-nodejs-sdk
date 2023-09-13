"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const test_utils_1 = require("../test-utils");
const utils_1 = require("../utils");
const SHUTDOWN_URL = process.env.YDB_SHUTDOWN_URL || 'http://localhost:8765/actors/kqp_proxy?force_shutdown=all';
describe('Graceful session close', () => {
    let driver;
    afterAll(async () => await (0, test_utils_1.destroyDriver)(driver));
    it('All sessions should be closed from the server side and be deleted upon return to the pool', async () => {
        const PREALLOCATED_SESSIONS = 10;
        driver = await (0, test_utils_1.initDriver)({ poolSettings: {
                maxLimit: PREALLOCATED_SESSIONS,
                minLimit: PREALLOCATED_SESSIONS
            } });
        // give time for the asynchronous session creation to finish before shutting down all existing sessions
        await (0, utils_1.sleep)(100);
        await http_1.default.get(SHUTDOWN_URL);
        let sessionsToClose = 0;
        const promises = [];
        for (let i = 0; i < 200; i++) {
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
