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

    it('general', async () => {
        await topicService.createTopic({
            path: 'myTopic',
        });
        console.info(`Service created`);

        const writer = await topicService.openWriteStreamWithEvent({
            path: 'myTopic',
        });
        writer.events.on('error', (err) => {
            console.error('Writer error:', err);
        });
        console.info(`Topic writer created`);

        await stepResult(`Writer initialized`, (resolve) => {
            writer.events.once('initResponse', (_v) => {
                resolve(undefined);
            });
        });

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
        await stepResult(`Message sent`, (resolve) => {
            writer.events.once("writeResponse", (_v) => {
                resolve(undefined);
            });
        });

        writer.close();
        await stepResult(`Writer closed`, (resolve) => {
            writer.events.once("end", () => {
                resolve(undefined);
            });
        });

        /////////////////////////////////////////////////
        // Now read the message

        // const reader = await topicService.openReadStreamWithEvents({
        //     readerName: 'reader1',
        //     consumer: 'testC',
        //     topicsReadSettings: [{
        //         path: 'myTopic2',
        //         partitionIds: [1],
        //     }],
        // });
        // reader.events.on('error', (err) => {
        //    console.error('Reader error:', err);
        // });
        //
        // await stepResult(`Topic reader created`, (resolve) => {
        //     reader.events.once("initResponse", () => {
        //         resolve(undefined);
        //     });
        // });
        //
        // await stepResult(`Start partition`, (resolve) => {
        //     reader.events.once('startPartitionSessionRequest', (v) => {
        //         console.info(`Partition: ${v}`)
        //         reader.startPartitionSessionResponse({
        //             partitionSessionId: v.partitionSession?.partitionSessionId,
        //         });
        //         resolve(undefined);
        //     });
        // });
        //
        // await stepResult(`Message read`, (resolve) => {
        //     reader.events.once('readResponse', (v) => {
        //         console.info(`Message: ${v}`)
        //         resolve(undefined);
        //     });
        // });
        //
        // reader.close();
        // await stepResult(`Reader closed`, (resolve) => {
        //     reader.events.once("end", () => {
        //         resolve(undefined);
        //     });
        // });
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

    async function stepResult<T>(message: String, cb: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => T): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            try {
                cb(resolve, reject);
                console.info(message);
            } catch (err) {
                reject(err);
                console.error('Step failed:', err);
            }
        });
    }
});
