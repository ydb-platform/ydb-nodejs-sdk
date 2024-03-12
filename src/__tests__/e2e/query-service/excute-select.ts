import DiscoveryService from "../../../discovery/discovery-service";
import {ENDPOINT_DISCOVERY_PERIOD} from "../../../constants";
import {AnonymousAuthService} from "../../../credentials/anonymous-auth-service";
import {getLogger} from "../../../logging";
import {SessionBuilder} from "../../../query/query-session-pool";
import {QuerySession} from "../../../query/query-session";

const DATABASE = '/local';
const ENDPOINT = 'grpcs://localhost:2136';

describe('Create table', () => {

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
        await session.delete();
    });

    it('execute select', async () => {
        session.execute({
            txControl: {
                beginTx: {

                }
            }
        })
    });
});
