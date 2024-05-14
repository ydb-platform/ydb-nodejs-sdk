import {AnonymousAuthService} from "../../../credentials/anonymous-auth-service";
import DiscoveryService from "../../../discovery/discovery-service";
import {ENDPOINT_DISCOVERY_PERIOD} from "../../../constants";
import {SessionBuilder} from "../../../query/query-session-pool";
import {QuerySession, IExecuteResult} from "../../../query";
import * as symbols from "../../../query/symbols";
import {getDefaultLogger} from "../../../logger/get-default-logger";

const DATABASE = '/local';
const ENDPOINT = 'grpc://localhost:2136';

describe('Query service transactions', () => {

    let discoveryService: DiscoveryService;
    let session: QuerySession;

    beforeAll(async () => {
        await testOnOneSessionWithoutDriver();
    });

    afterAll(async () => {
        discoveryService.destroy();
        await session[symbols.sessionReleaseSymbol]();
        await session.delete();
    });

    it.only('implicit transactions', async () => {

        // open transaction
        expect(session.txId).toBeUndefined();

        await drainExecuteResult(await session.execute({
            txControl: {beginTx: {serializableReadWrite: {}}},
            text: 'SELECT 1;',
        }));

        expect(session.txId).toBeDefined();
        const newTxId = session.txId;

        await expect(async () => {
            await session.execute({
                txControl: {beginTx: {serializableReadWrite: {}}},
                text: 'SELECT 1;',
            });
        }).rejects.toThrow(); // transaction is already closed

        // continue transaction
        await drainExecuteResult(await session.execute({
            // txControl: ,
            text: 'SELECT 1;',
        }));

        expect(session.txId).toBe(newTxId);

        // close transaction
        await drainExecuteResult(await session.execute({
            txControl: {commitTx: true},
            text: 'SELECT 1;',
        }));

        expect(session.txId).toBeUndefined();

        await expect(async () => {
            await session.execute({
                txControl: {commitTx: true},
                text: 'SELECT 1;',
            });
        }).rejects.toThrow(); // transaction is already closed

    });

    it('explicit transactions', async () => {

        // open transaction
        expect(session.txId).toBeUndefined();

        await session.beginTransaction({serializableReadWrite: {}});

        expect(session.txId).toBeDefined();

        await expect(async () => {
            await session.beginTransaction({serializableReadWrite: {}});
        }).rejects.toThrow(); // transaction is already open

        // commit transaction
        await session.commitTransaction();

        expect(session.txId).toBeUndefined();

        await expect(async () => {
            await session.commitTransaction();
        }).rejects.toThrow(); // transaction is already closed

        // same about rallback
        await session.beginTransaction({serializableReadWrite: {}});

        await session.rollbackTransaction();

        expect(session.txId).toBeUndefined();

        await expect(async () => {
            await session.rollbackTransaction();
        }).rejects.toThrow(); // transaction is already closed
    });

    async function drainExecuteResult(res: IExecuteResult) {
        for await (const rs of res.resultSets)
            for await (const _row of rs.rows) {
            }
    }

    async function testOnOneSessionWithoutDriver() {
        const logger = getDefaultLogger();
        const authService = new AnonymousAuthService();

        discoveryService = new DiscoveryService({
            endpoint: ENDPOINT,
            database: DATABASE,
            authService,
            discoveryPeriod: ENDPOINT_DISCOVERY_PERIOD,
            logger,
        });

        await discoveryService.ready(ENDPOINT_DISCOVERY_PERIOD);

        const sessionBuilder = new SessionBuilder(
            await discoveryService.getEndpoint(),
            DATABASE,
            authService,
            logger,
        );

        session = await sessionBuilder.create();
    }
});
