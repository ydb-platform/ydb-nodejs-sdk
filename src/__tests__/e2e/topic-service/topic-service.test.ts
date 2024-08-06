import DiscoveryService from "../../../discovery/discovery-service";
import {ENDPOINT_DISCOVERY_PERIOD} from "../../../constants";
import {AnonymousAuthService} from "../../../credentials/anonymous-auth-service";
import {getDefaultLogger} from "../../../logger/get-default-logger";
import {TopicService} from "../../../topic";
import {google, Ydb} from "ydb-sdk-proto";

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
        let waitResolve: any, waitPromise: Promise<any>;

        await topicService.createTopic({
            path: 'myTopic2',
        });
        console.info(`Service created`);

        const writer = await topicService.openWriteStream({
            path: 'myTopic2',
        });
        writer.events.on('error', (err) => {
            console.error(err);
        });
        console.info(`Topic writer created`);

        waitPromise = new Promise((resolve) => {
            waitResolve = resolve;
        });
        writer.events.on('initResponse', (_v) => {
            waitResolve();
        });
        await waitPromise;
        console.info(`Writer initialized`);

        await writer.writeRequest({
            // tx:
            codec: Ydb.Topic.Codec.CODEC_RAW,
            messages: [{
                data: Buffer.alloc(100, '1234567890'),
                uncompressedSize: '1234567890'.length,
                seqNo: 1,
                createdAt: google.protobuf.Timestamp.create({
                    seconds: Date.now() / 1000,
                    nanos: Date.now() % 1000,
                }),
                messageGroupId: 'abc', // TODO: Check examples
                partitionId: 1,
                // metadataItems: // TODO: Should I use this?
            }],
        });

        waitPromise = new Promise((resolve) => {
            waitResolve = resolve;
        });
        writer.events.on("writeResponse", (_v) => {
            waitResolve();
        });
        await waitPromise;
        console.info(`Message sent`);

        await writer.dispose();
        console.info(`Writer disposed`);

        /////////////////////////////////////////////////
        // Now read the message

        const reader = await topicService.openReadStream({
            readerName: 'reasder1',
            consumer: 'testC',
            topicsReadSettings: [{
                path: 'myTopic2',
                // partitionIds: [1],
            }],
        });
        reader.events.on('error', (err) => {
           console.error(err);
        });

        waitPromise = new Promise((resolve) => {
            waitResolve = resolve;
        });
        reader.events.on('initResponse', (_v) => {
            waitResolve();
        });
        await waitPromise;
        console.info(`Topic reader created`);

        // reader.readRequest({
        // });
        //
        // waitPromise = new Promise((resolve) => {
        //     waitResolve = resolve;
        // });
        // reader.events.on('readResponse', (v) => {
        //     console.info(`Message read: ${v}`)
        //     waitResolve();
        // });
        // await waitPromise;

        await reader.dispose();
        console.info(`Reader disposed`);

        await topicService.dispose();
        console.info(`Topic service disposed`);
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
