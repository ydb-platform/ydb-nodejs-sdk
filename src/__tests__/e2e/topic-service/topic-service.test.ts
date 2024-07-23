import DiscoveryService from "../../../discovery/discovery-service";
import {ENDPOINT_DISCOVERY_PERIOD} from "../../../constants";
import {AnonymousAuthService} from "../../../credentials/anonymous-auth-service";
import {getDefaultLogger} from "../../../logger/get-default-logger";
import {TopicService} from "../../../topic";
// import {google, Ydb} from "ydb-sdk-proto";

const DATABASE = '/local';
const ENDPOINT = 'grpc://localhost:2136';

describe('Topic: General', () => {
    let discoveryService: DiscoveryService;
    let topicService: TopicService;

    beforeEach(async () => {
        await testOnOneSessionWithoutDriver();
    });

    afterEach(async () => {
        discoveryService.destroy();
        if (topicService) topicService.dispose();
    });

    it.only('write: simple', async () => {
        console.info(1000);
        await topicService.createTopic({
            path: 'MyTopic',
        });

        const writer = await topicService.openWriteStream({
            path: 'MyTopic',
        });

        // expect()

        // writer.events.on('initResponse', (resp) => {
        //     resp.
        // })

        // writer.write(Ydb.Topic.StreamWriteMessage.WriteRequest.create({
        //     messages: [
        //         Ydb.Topic.StreamWriteMessage.WriteRequest.MessageData.create({
        //             seqNo: 1,
        //             createdAt: google.protobuf.Timestamp.create({
        //                 seconds: 100,
        //                 nanos: 0,
        //             }),
        //             // metadataItems: [
        //             //     Ydb.Topic.MetadataItem.create({
        //             //         key: 'a',
        //             //         value: [0, 1],
        //             //     }),
        //             // ]
        //             // uncompressedSize: 100,
        //             // data: new Buffer(),
        //         }),
        //     ],
        // }));

        await new Promise((resolve) => setTimeout(resolve, 4_000));

        console.info(1300);

        await writer.dispose();
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
        topicService = new TopicService(
            await discoveryService.getEndpoint(), // TODO: Should be one per endpoint
            DATABASE,
            authService,
            logger,
        );
    }
});
