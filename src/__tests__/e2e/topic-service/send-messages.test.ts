import {AnonymousAuthService, Driver as YDB} from '../../../index';
import {google, Ydb} from "ydb-sdk-proto";


// create topic

describe('Topic: Send messages', () => {
    let ydb: YDB | undefined;

    beforeEach(async () => {
        ydb = new YDB({
            connectionString: 'grpc://localhost:2136/?database=local',
            authService: new AnonymousAuthService(),
        });
    });

    afterEach(async () => {
        if (ydb) {
            await ydb.destroy();
            ydb = undefined;
        }
    });

    it('General', async () => {
        const topicClient = await ydb!.topic;

        await topicClient.createTopic({
            path: 'testTopic'
        });

        const writer = await topicClient.createWriter({
            path: 'testTopic'
        });

        const res1 = await writer.sendMessages({
            // tx:
            codec: Ydb.Topic.Codec.CODEC_RAW,
            messages: [{
                data: Buffer.alloc(10, '1234567890'),
                uncompressedSize: '1234567890'.length,
                seqNo: 1,
                createdAt: google.protobuf.Timestamp.create({
                    seconds: 123 /* Math.trunc(Date.now() / 1000) */,
                    nanos: 456 /* Date.now() % 1000 */,
                }),
                messageGroupId: 'abc', // TODO: Check examples
                partitionId: 1,
                // metadataItems: // TODO: Should I use this?
            }],
        });

        console.info('res1:', res1);

        const res2 = await writer.sendMessages({
            // tx:
            codec: Ydb.Topic.Codec.CODEC_RAW,
            messages: [{
                data: Buffer.alloc(10, '1234567890'),
                uncompressedSize: '1234567890'.length,
                seqNo: 1,
                createdAt: google.protobuf.Timestamp.create({
                    seconds: 123 /*Date.now() / 1000*/,
                    nanos: 456 /*Date.now() % 1000*/,
                }),
                messageGroupId: 'abc', // TODO: Check examples
                partitionId: 1,
                // metadataItems: // TODO: Should I use this?
            }],
        });

        console.info('res2:', res2);

        const res3 = await writer.sendMessages({
            // tx:
            codec: Ydb.Topic.Codec.CODEC_RAW,
            messages: [{
                data: Buffer.alloc(10, '1234567890'),
                uncompressedSize: '1234567890'.length,
                seqNo: 1,
                createdAt: google.protobuf.Timestamp.create({
                    seconds: 123 /*Date.now() / 1000*/,
                    nanos: 456 /*Date.now() % 1000*/,
                }),
                messageGroupId: 'abc', // TODO: Check examples
                partitionId: 1,
                // metadataItems: // TODO: Should I use this?
            }],
        });

        console.info('res3:', res3);

        // TODO: Send few messages

        // TODO: Wait for ack

        // TODO: Close before all messages are acked

        // TODO: Error - Thunk how to test that
    });
});
