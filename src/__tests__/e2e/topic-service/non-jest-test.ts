import {getDefaultLogger} from "../../../logger/get-default-logger";
import {AnonymousAuthService} from "../../../credentials/anonymous-auth-service";
import DiscoveryService from "../../../discovery/discovery-service";
import {ENDPOINT_DISCOVERY_PERIOD} from "../../../constants";
import {TopicService} from "../../../topic";
// @ts-ignore
import {google, Ydb} from "ydb-sdk-proto";

const DATABASE = '/local';
const ENDPOINT = 'grpc://localhost:2136';

async function testOnOneSessionWithoutDriver() {
    const logger = getDefaultLogger();
    const authService = new AnonymousAuthService();
    const discoveryService = new DiscoveryService({
        endpoint: ENDPOINT,
        database: DATABASE,
        authService,
        discoveryPeriod: ENDPOINT_DISCOVERY_PERIOD,
        logger,
    });
    await discoveryService.ready(ENDPOINT_DISCOVERY_PERIOD);
    const topicService = new TopicService(
        await discoveryService.getEndpoint(), // TODO: Should be one per endpoint
        DATABASE,
        authService,
        logger,
    );
    return topicService;
}

(async () => {
    const topicService = await testOnOneSessionWithoutDriver();

    console.info(1000);
    await topicService.createTopic({
        path: 'MyTopic',
    });

    const writer = await topicService.openWriteStream({
        path: 'MyTopic',
    });

    // @ts-ignore
    let waitResolve: any;
    // @ts-ignore
    let waitPromise = new Promise((resolve) => {
        waitResolve = resolve;
    })

    writer.events.on('initResponse', (v) => {
        console.info(3900, v);
        waitResolve();
    });

    waitPromise = new Promise((resolve) => {
        waitResolve = resolve;
    })
    writer.events.on("writeResponse", (v) => {
        console.info(4000, v);
        // waitResolve();
    })

    writer.writeRequest({
        codec: Ydb.Topic.Codec.CODEC_RAW,
        messages: [{
            data: Buffer.alloc(1000, 'test messsage'),
            uncompressedSize: 'test messsage'.length,
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

    console.info(4100);

    // await new Promise((resolve) => setTimeout(resolve, 4_000));

    // console.info(1300);
    //
    await writer.dispose();

    // -----

    const reader = await topicService.openReadStream({
        readerName: 'reasder1',
        consumer: 'testConsumer',
        topicsReadSettings: [{
           path: 'MyTopic',
           partitionIds: [1],
        }],
    });

    waitPromise = new Promise((resolve) => {
        waitResolve = resolve;
    })
    reader.events.on("readResponse", (data) => {
        console.info(`Read from myTopic ${JSON.stringify(data, null, 2)}`);
        waitResolve();
    });

    await waitPromise;

    await reader.dispose();

    console.info(`Test completed`);
})();
