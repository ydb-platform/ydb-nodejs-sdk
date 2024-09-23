if (process.env.TEST_ENVIRONMENT === 'dev') require('dotenv').config();
import DiscoveryService from "../../../discovery/discovery-service";
import {ENDPOINT_DISCOVERY_PERIOD} from "../../../constants";
import {AnonymousAuthService} from "../../../credentials/anonymous-auth-service";
import {getDefaultLogger} from "../../../logger/get-default-logger";
import {google, Ydb} from "ydb-sdk-proto";
import Long from "long";
import {
    ReadStreamCommitOffsetResult,
    ReadStreamInitResult,
    ReadStreamReadResult,
    ReadStreamStartPartitionSessionArgs
} from "../../../topic/internal/topic-read-stream-with-events";
import {WriteStreamInitResult, WriteStreamWriteResult} from "../../../topic/internal/topic-write-stream-with-events";
import {TopicNodeClient} from "../../../topic/internal/topic-node-client";
import {Context} from "../../../context";
import {RetryParameters} from "../../../retries/retryParameters";
import {RetryStrategy} from "../../../retries/retryStrategy";

const DATABASE = '/local';
const ENDPOINT = process.env.YDB_ENDPOINT || 'grpc://localhost:2136';

describe('Topic: General', () => {
    let discoveryService: DiscoveryService;
    let topicService: TopicNodeClient;

    beforeEach(async () => {
        await testOnOneSessionWithoutDriver();
    });

    afterEach(async () => {
        discoveryService.destroy();
        if (topicService) await topicService.destroy();
    });

    it('general', async () => {
        await topicService.createTopic({
            path: 'myTopic',
            consumers: [
                {
                    name: 'testC',
                }
            ],
        });
        console.info(`Service created`);

        const writer = await topicService.openWriteStreamWithEvents(Context.createNew().ctx, {
            path: 'myTopic',
            producerId: 'cd9e8767-f391-4f97-b4ea-75faa7b0642d',
            messageGroupId: 'cd9e8767-f391-4f97-b4ea-75faa7b0642d',
            getLastSeqNo: true,
            writeSessionMeta: {
                keyA: 'valueA',
                keyB: 'valueB'
            },
            // partitionId: 1,
        });
        writer.events.on('error', (err) => {
            console.error('Writer error:', err);
        });
        console.info(`Topic writer created`);

        const initRes = await stepResult<WriteStreamInitResult>(`Writer initialized`, (resolve) => {
            writer.events.once('initResponse', (v) => {
                resolve(v);
            });
        });
        console.info(`initRes:`, initRes);

        await writer.writeRequest({
            // tx:
            codec: Ydb.Topic.Codec.CODEC_RAW,
            messages: [{
                data: Buffer.alloc(10, '1234567890'),
                uncompressedSize: '1234567890'.length,
                seqNo: initRes.lastSeqNo ? Long.fromValue(initRes.lastSeqNo!).add(1) : 1,
                createdAt: google.protobuf.Timestamp.create({
                    seconds: 123 /* Math.trunk(Date.now() / 1000) */,
                    nanos: 456 /* (Date.now() % 1000) * 1000 */,
                }),
                messageGroupId: 'testProducer',
                partitionId: 1,
                metadataItems: [{
                    key: 'key1',
                    value: new TextEncoder().encode('value1')
                }]
                // metadataItems: // TODO: Should I use this?
            }],
        });
        const sentRes = await stepResult<WriteStreamWriteResult>(`Message sent`, (resolve) => {
            writer.events.once("writeResponse", (v) => {
                resolve(v);
            });
        });
        console.info('sentRes:', sentRes);

        writer.close();
        await stepResult(`Writer closed`, (resolve) => {
            writer.events.once("end", () => {
                resolve(undefined);
            });
        });

        /////////////////////////////////////////////////
        // Now read the message

        const reader= await topicService.openReadStreamWithEvents({
            readerName: 'reader1',
            consumer: 'testC',
            topicsReadSettings: [{
                path: 'myTopic',
                // partitionIds: [1],
            }],
        });
        reader.events.on('error', (err) => {
           console.error('Reader error:', err);
        });

        const topicRes = await stepResult<ReadStreamInitResult>(`Topic reader created`, (resolve) => {
            reader.events.once("initResponse", (v) => {
                resolve(v);
            });
        });
        console.info('topicRes:', topicRes);

        const partitionRes = await stepResult<ReadStreamStartPartitionSessionArgs>(`Start partition`, (resolve) => {
            reader.events.once('startPartitionSessionRequest', async (v) => {
                await reader.startPartitionSessionResponse({
                    partitionSessionId: v.partitionSession?.partitionSessionId,
                });
                resolve(v);
            });
        });
        console.info(`partitionRes:`, partitionRes);

        await reader.readRequest({
            bytesSize: 10000,
        })
        const message = await stepResult<ReadStreamReadResult>(`Message read`, (resolve) => {
            reader.events.once('readResponse', (v) => {
                resolve(v);
            });
        });
        console.info('message:', message);
        // expect(message).toEqual({
        //
        // });

        await reader.commitOffsetRequest({
            commitOffsets: [{
                partitionSessionId: message.partitionData![0].partitionSessionId,
                offsets: [
                    {
                        start: message.partitionData![0].batches![0].messageData![0].offset!,
                        end: Long.fromValue(message.partitionData![0].batches![0].messageData![0].offset!).add(1),
                    }
                ]
            }],
        });
        const commitRes = await stepResult<ReadStreamCommitOffsetResult>(`Message read commit`, (resolve) => {
            reader.events.once('commitOffsetResponse', (v) => {
                resolve(v);
            });
        });
        console.info('commitRes:', commitRes);
        // expect(commitRes).toEqual({
        //
        // });

        reader.close();
        await stepResult(`Reader closed !!!`, (resolve) => {
            reader.events.once("end", () => {
                resolve(undefined);
            });
        });
    });

    async function testOnOneSessionWithoutDriver() {
        const logger = getDefaultLogger();
        const authService = new AnonymousAuthService();
        discoveryService = new DiscoveryService({
            endpoint: ENDPOINT,
            database: DATABASE,
            authService,
            discoveryPeriod: ENDPOINT_DISCOVERY_PERIOD,
            retrier: new RetryStrategy(new RetryParameters(), logger),
            logger,
        });
        await discoveryService.ready(ENDPOINT_DISCOVERY_PERIOD);
        topicService = new TopicNodeClient(
            await discoveryService.getEndpoint(), // TODO: Should be one per endpoint
            DATABASE,
            authService,
            logger,
        );
    }

    async function stepResult<T>(message: String, cb: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            try {
                console.info(message);
                cb(resolve, reject);
            } catch (err) {
                console.error('Step failed:', err);
                reject(err);
            }
        });
    }
});
