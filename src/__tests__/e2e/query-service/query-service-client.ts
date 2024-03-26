import Driver from "../../../driver";
import {AnonymousAuthService} from "../../../credentials/anonymous-auth-service";
import {IExecuteResult} from "../../../query/query-session-execute";
import * as errors from "../../../errors";
import path from "path";
import fs from "fs";
import {AUTO_TX} from "../../../table";
import {QuerySession} from "../../../query/query-session";

const DATABASE = '/local';
const ENDPOINT = 'grpcs://localhost:2135';

describe('Query client', () => {

    let driver: Driver;

    beforeAll(async () => {
        const certFile = process.env.YDB_SSL_ROOT_CERTIFICATES_FILE || path.join(process.cwd(), 'ydb_certs/ca.pem');
        if (!fs.existsSync(certFile)) {
            throw new Error(`Certificate file ${certFile} doesn't exist! Please use YDB_SSL_ROOT_CERTIFICATES_FILE env variable or run Docker container https://cloud.yandex.ru/docs/ydb/getting_started/ydb_docker inside working directory`);
        }
        const sslCredentials = {rootCertificates: fs.readFileSync(certFile)};

        // TODO: Figure out why Driver fails become ready without sslCredentials
        driver = new Driver({
            endpoint: ENDPOINT,
            database: DATABASE,
            authService: new AnonymousAuthService(),
            sslCredentials,
        });
        if (!(await driver.ready(3000))) throw new Error('Driver is not ready!');
    });

    afterAll(async () => await driver?.destroy());

    it.only('Query client do()', async () => {
        let count = 0;
        let prevSession: QuerySession;
        const res = await driver.queryClient.do({
            fn: async (session) => {
                count++;

                if (prevSession) expect(prevSession).toBe(session); // session gets reused

                expect(session.txId).not.toBeDefined();

                // test operation on DB with explicite transaction
                let res = await session.execute({
                    txControl: {beginTx: AUTO_TX.beginTx},
                    text: 'SELECT 1',
                });
                await drainExecuteResult(res);

                expect(session.txId).toBeDefined();

                res = await session.execute({
                    text: 'SELECT 1',
                });
                await drainExecuteResult(res);

                expect(session.txId).toBeDefined();

                // force new attempt
                if (count < 3) throw new errors.Unavailable('test'); // an fast backoff error

                res = await session.execute({
                    txControl: {commitTx: true},
                    text: 'SELECT 1',
                });
                await drainExecuteResult(res);

                expect(session.txId).not.toBeDefined();

                // result
                return 12;
            }
        });
        expect(res).toBe(12);
        expect(count).toBe(3);
    });

    // it('Auto commit', async () => {
    // it('Auto rollback', async () => {
    // it('Broken session', async () => {

    it('Query client doTx()', async () => {
        let prevSession: QuerySession;
        let count = 0;
        const res = await driver.queryClient.doTx({
            fn: async (session) => {
                count++;

                expect(session.txId).not.toBeDefined(); // actual transaction will be created on first session.execute

                if (prevSession) expect(prevSession).toBe(session); // session gets reused
                prevSession = session;

                await expect(async () =>
                    await session.execute({
                        txControl: {beginTx: AUTO_TX.beginTx},
                        text: 'SELECT 1',
                    })
                ).rejects.toThrowError(
                    new Error('Cannot manage transactions at the session level if do() has the txSettings parameter or doTx() is used'));

                let res = await session.execute({
                    text: 'SELECT 1',
                });
                await drainExecuteResult(res);

                expect(session.txId).toBeDefined();

                res = await session.execute({
                    text: 'SELECT 1',
                });
                await drainExecuteResult(res);

                expect(session.txId).toBeDefined();

                // force new attempt
                if (count < 2) throw new errors.Unavailable('test'); // an fast backoff error

                await expect(async () =>
                    await session.commitTransaction()
                ).rejects.toThrowError(
                    new Error('Cannot manage transactions at the session level if do() has the txSettings parameter or doTx() is used'));

                await expect(async () =>
                    session.rollbackTransaction()
                ).rejects.toThrowError(
                    new Error('Cannot manage transactions at the session level if do() has the txSettings parameter or doTx() is used'));

                expect(session.txId).toBeDefined();

                // result
                return 12;
            }
        });
        expect(res).toBe(12);
        expect(count).toBe(2);
    });

    // it('Auto commit or rollback', async () => {
    //
    // });

    // @ts-ignore
    async function drainExecuteResult(res: IExecuteResult) {
        for await (const rs of res.resultSets)
            for await (const _row of rs.rows) {
            }
    }
});
