import Driver from "../../../driver";
import {AnonymousAuthService} from "../../../credentials/anonymous-auth-service";
import {IExecuteResult} from "../../../query/query-session-execute";
// @ts-ignore
import * as errors from "../../../errors";
import path from "path";
import fs from "fs";
import {QuerySession} from "../../../query/query-session";

const DATABASE = '/local';
const ENDPOINT = 'grpcs://localhost:2135';
// const TABLE_NAME = 'test_table_20240313'
const SESSION_MAX_LIMIT = 2;

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
            poolSettings: {
                minLimit: 1, // TODO: Reconsider. Currently disabled
                maxLimit: SESSION_MAX_LIMIT,
            }
        });
        if (!(await driver.ready(3000))) throw new Error('Driver is not ready!');
    });

    afterAll(async () => await driver?.destroy());

    it('Query client do()', async () => {
        const usedSessions: QuerySession[] = [];
        let prevSession: QuerySession;
        let count = 0;
        const res = await driver.queryClient.do({
            fn: async (session) => {
                count++;

                // use different session for every attempt
                if (count > 1) expect(prevSession.sessionId).not.toBe(session.sessionId);
                prevSession = session;

                // reuse existing sessions
                if (count > SESSION_MAX_LIMIT) expect(usedSessions.findIndex(v => v === session)).not.toBe(-1);
                usedSessions.push(session);

                // force new attempt
                if (count < 4) throw new errors.Unavailable('test'); // an fast backoff error

                // test operation on DB
                const res = await session.execute({
                   text: 'SELECT 1',
                });
                await drainExecuteResult(res);

                // result
                return 12;
            }
        });
        expect(res).toBe(12);
        expect(count).toBe(4);
    });

    // it('Query client doTx()', async () => {
    //
    // });
    //
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
