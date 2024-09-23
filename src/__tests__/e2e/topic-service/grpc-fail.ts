if (process.env.TEST_ENVIRONMENT === 'dev') require('dotenv').config();
import {google, Ydb} from "ydb-sdk-proto";
import {sleep} from "../../../utils";
import {AnonymousAuthService, Driver as YDB, Logger} from "../../../index";
import {SimpleLogger} from "../../../logger/simple-logger";

const DATABASE = '/local';
const ENDPOINT = process.env.YDB_ENDPOINT || 'grpc://localhost:2136';

// console.info(`Use ${ENDPOINT}?database=${DATABASE}`);

describe('internal stream', () => {
    let logger: Logger = new SimpleLogger();
    let ydb: YDB | undefined;

    beforeEach(async () => {
        ydb = new YDB({
            connectionString: `${ENDPOINT}?database=${DATABASE}`,
            authService: new AnonymousAuthService(),
            logger: new SimpleLogger({
                showTimestamp: false,
            })
        });
        await ydb.ready(3000);

        const res = await ydb.topic.createTopic({
            path: 'myTopic'
        });

        logger.info('createTopic(): %o', res);
    });

    it('forceable end', async () => {

        const stream = await ydb!.topic.createWriter({
            path: 'myTopic',
            getLastSeqNo: true,
        });

        //     new TopicWriteStreamWithEvents({
        //     path: 'myTopic',
        //     producerId: 'cd9e8767-f391-4f97-b4ea-75faa7b0642d',
        //     getLastSeqNo: true,
        // }, await (ydb! as any).discoveryService.getTopicNodeClient(), logger);

        // stream.writeRequest({
        //     codec: Ydb.Topic.Codec.CODEC_RAW,
        //     messages: [{
        //         data: Buffer.alloc(10, '1234567890'),
        //         uncompressedSize: '1234567890'.length,
        //         createdAt: google.protobuf.Timestamp.create({
        //             seconds: 123,
        //             nanos: 456,
        //         }),
        //     }],
        // });

        logger.info('before sleep')

        await sleep(30_000)

        logger.info('after sleep')

        stream.writeRequest({
            codec: Ydb.Topic.Codec.CODEC_RAW,
            messages: [{
                data: Buffer.alloc(10, '1234567890'),
                uncompressedSize: '1234567890'.length,
                createdAt: google.protobuf.Timestamp.create({
                    seconds: 123,
                    nanos: 456,
                }),
            }],
        });

        // stream.close();
    }, 60_000);
});
