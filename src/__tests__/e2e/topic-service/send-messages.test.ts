if (process.env.TEST_ENVIRONMENT === 'dev') require('dotenv').config();
// import {AnonymousAuthService, Driver as YDB} from '../../../index';
// import {google, Ydb} from "ydb-sdk-proto";

// create topic


// xdescribe('Topic: Send messages', () => {
//     let ydb: YDB | undefined;
//
//     beforeEach(async () => {
//         ydb = new YDB({
//             connectionString: `${ENDPOINT}/?database=${DATABASE}`,
//             authService: new AnonymousAuthService(),
//         });
//     });
//
//     afterEach(async () => {
//         if (ydb) {
//             await ydb.destroy();
//             ydb = undefined;
//         }
//     });
//
//         const topicClient = await ydb!.topic;
//
//         await topicClient.createTopic({
//             path: 'testTopic'
//         });
//
//         const writer = await topicClient.createWriter({
//             path: 'testTopic',
//             producerId: 'cd9e8767-f391-4f97-b4ea-75faa7b0642e',
//             // messageGroupId: 'cd9e8767-f391-4f97-b4ea-75faa7b0642e',
//             getLastSeqNo: true,
//         });
//
//         // if getLastSeqNo: true wate till init be accomplished
//
//         const res1 = await writer.sendMessages({
//             codec: Ydb.Topic.Codec.CODEC_RAW,
//             messages: [{
//                 data: Buffer.alloc(10, '1234567890'),
//                 uncompressedSize: '1234567890'.length,
//                 createdAt: google.protobuf.Timestamp.create({
//                     seconds: 123 /*Date.now() / 1000*/,
//                     nanos: 456 /*Date.now() % 1000*/,
//                 }),
//             }],
//         });
//
//         console.info('res1:', res1);
//
//         const res2 = await writer.sendMessages({
//             // tx:
//             codec: Ydb.Topic.Codec.CODEC_RAW,
//             messages: [{
//                 data: Buffer.alloc(10, '1234567890'),
//                 uncompressedSize: '1234567890'.length,
//                 createdAt: google.protobuf.Timestamp.create({
//                     seconds: 123 /*Date.now() / 1000*/,
//                     nanos: 456 /*Date.now() % 1000*/,
//                 }),
//                 messageGroupId: 'abc', // TODO: Check examples
//                 partitionId: 1,
//                 // metadataItems: // TODO: Should I use this?
//             }],
//         });
//
//         console.info('res2:', res2);
//
//         const res3 = await writer.sendMessages({
//             // tx:
//             codec: Ydb.Topic.Codec.CODEC_RAW,
//             messages: [{
//                 data: Buffer.alloc(10, '1234567890'),
//                 uncompressedSize: '1234567890'.length,
//                 // createdAt: google.protobuf.Timestamp.create({
//                 //     seconds: 123 /* Math.trunk(Date.now() / 1000) */,
//                 //     nanos: 456 /* (Date.now() % 1000) * 1000 */,
//                 // }),
//                 // messageGroupId: 'abc', // TODO: Check examples
//                 // partitionId: 1,
//                 // metadataItems: // TODO: Should I use this?
//             }],
//         });
//
//         console.info('res3:', res3);
//
//         // TODO: Send few messages
//
//         // TODO: Wait for ack
//
//         // TODO: Close before all messages are acked
//
//         // TODO: Error - Thunk how to test that
//     });
// });
