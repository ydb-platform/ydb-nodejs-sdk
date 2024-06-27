import DiscoveryService from "../../../discovery/discovery-service";
import {ENDPOINT_DISCOVERY_PERIOD} from "../../../constants";
import {AnonymousAuthService} from "../../../credentials/anonymous-auth-service";
import {getDefaultLogger} from "../../../logger/get-default-logger";
import {InternalTopicService} from "../../../topic";

const DATABASE = '/local';
const ENDPOINT = 'grpc://localhost:2136';

describe('Query.execute()', () => {
    let discoveryService: DiscoveryService;
    let topicService: InternalTopicService;

    beforeEach(async () => {
        await testOnOneSessionWithoutDriver();
    });

    afterEach(async () => {
        discoveryService.destroy();
        await topicService.destroy();
    });

    it('write: simple', async () => {
        // topicService.dispose();

    });

    it('read: simple', async () => {

    });

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
        topicService = new InternalTopicService(
            await discoveryService.getEndpoint(), // TODO: Should be one per endpoint
            DATABASE,
            authService,
            logger,
        );
    }
});
