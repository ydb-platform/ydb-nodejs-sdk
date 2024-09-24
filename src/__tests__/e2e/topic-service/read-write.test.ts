import {AnonymousAuthService, Driver as YDB, Logger} from "../../../index";
// @ts-ignore
import {Context} from "../../../context";
import {SimpleLogger} from "../../../logger/simple-logger";
import {Ydb} from "ydb-sdk-proto";

if (process.env.TEST_ENVIRONMENT === 'dev') require('dotenv').config();

const DATABASE = '/local';
const ENDPOINT = process.env.YDB_ENDPOINT || 'grpc://localhost:2136';

describe('topic: read-write', () => {
    // @ts-ignore
    let logger: Logger;
    let ydb: YDB | undefined;

    beforeEach(async () => {
        ydb = new YDB({
            connectionString: `${ENDPOINT}/?database=${DATABASE}`,
            authService: new AnonymousAuthService(),
            logger: logger = new SimpleLogger({
                showTimestamp: false,
                envKey: 'YDB_TEST_LOG_LEVEL'
            })
        });
    });

    afterEach(async () => {
        if (ydb) {
            await ydb.destroy();
            ydb = undefined;
        }
    });

    it('general', async () => {
        await ydb!.topic.createTopic({
            path: 'testTopic',
            consumers: [{name: 'testConsumer'}],
        });

        const writer = await ydb!.topic.createWriter({
            path: 'testTopic',
            producerId: 'cd9e8767-f391-4f97-b4ea-75faa7b0642e',
        });

        await writer.sendMessages({
            codec: Ydb.Topic.Codec.CODEC_RAW,
            messages: [{
                data: Buffer.alloc(10, '1234567890'),
                uncompressedSize: '1234567890'.length,
            }],
        });

        await writer.close();

        // await writer.sendMessages({
        //     codec: Ydb.Topic.Codec.CODEC_RAW,
        //     messages: [{
        //         data: Buffer.alloc(10, '1234567890'),
        //         uncompressedSize: '1234567890'.length,
        //     }],
        // });

        const reader = await ydb!.topic.createReader(Context.createNew({
            timeout: 10_000,
        }).ctx, {
            // TODO: Set initial free memory for messages
            // TODO: Start send readRequest to requests
            consumer: 'testConsumer',
            topicsReadSettings: [{path: 'myTopic'}],
        });

        // try {
        //     for await (const message of reader.messages) {
        //         // TODO: expect
        //         console.info(`Message: ${message}`);
        //     }
        // } catch (err) {
        //     logger.trace('Reader failed: %o', err);
        //     expect(Context.isTimeout(err)).toBe(true);
        // }

        await reader.close();
    }, 30_000);

    it.todo('retries', /*async () => {

    }*/);
});
