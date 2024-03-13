import DiscoveryService from "../../../discovery/discovery-service";
import {ENDPOINT_DISCOVERY_PERIOD} from "../../../constants";
import {AnonymousAuthService} from "../../../credentials/anonymous-auth-service";
import {getLogger} from "../../../logging";
import {SessionBuilder} from "../../../query/query-session-pool";
import {QuerySession} from "../../../query/query-session";

const DATABASE = '/local';
const ENDPOINT = 'grpcs://localhost:2136';

const TABLE_NAME = 'test_table_20240313'

describe('Query.execute()', () => {

    let discoveryService: DiscoveryService;
    let session: QuerySession;

    beforeAll(async () => {
        const logger = getLogger();
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
    });

    afterAll(async () => {
        discoveryService.destroy();
        // await session.delete();
    });

    it('create table', async () => {
        // TODO: Drop previouse table

        console.info(900)

        await session.execute({
            text: `
                DROP TABLE ${TABLE_NAME};`,
        });

        await session.execute({
            text: `
                CREATE TABLE ${TABLE_NAME}
                (
                    id    UInt64,
                    title Utf8,
                    time  Timestamp,
                    PRIMARY KEY (id)
                );`,
        });
    });

    // select simple
    // select multiple
    // number of operations under one transaction
    // doTx - txControl
    // update / insert
    // timeout

});
