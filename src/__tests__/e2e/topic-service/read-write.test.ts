import {AnonymousAuthService, Driver as YDB} from "../../../index";
import {Ydb} from "ydb-sdk-proto";
import {Context} from "../../../context";

if (process.env.TEST_ENVIRONMENT === 'dev') require('dotenv').config();

const DATABASE = '/local';
const ENDPOINT = process.env.YDB_ENDPOINT || 'grpc://localhost:2136';

describe('topic: read-write', () => {
    let ydb: YDB | undefined;

    beforeEach(async () => {
        ydb = new YDB({
            connectionString: `grpc://${ENDPOINT}/?database=${DATABASE}`,
            authService: new AnonymousAuthService(),
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

        writer.sendMessages({
            codec: Ydb.Topic.Codec.CODEC_RAW,
            messages: [{
                data: Buffer.alloc(10, '1234567890'),
                uncompressedSize: '1234567890'.length,
            }],
        });

        await writer.sendMessages({
            codec: Ydb.Topic.Codec.CODEC_RAW,
            messages: [{
                data: Buffer.alloc(10, '1234567890'),
                uncompressedSize: '1234567890'.length,
            }],
        });

        const reader = await ydb!.topic.createReader(Context.createNew({
            timeout: 3_000,
        }).ctx, {
            consumer: 'testConsumer',
            topicsReadSettings: [{path: 'myTopic'}],
        });

        try {
            for await (const message of reader.messages) {
                // TODO: expect
                console.info(`Message: ${message}`);
            }
        } catch (err) {
            expect(Context.isTimeout(err)).toBe(true);
        }
    });

    it.todo('retries', async () => {

    });
});
