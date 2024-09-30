import {Driver as YDB} from '../../../index';
import {AnonymousAuthService} from "../../../credentials/anonymous-auth-service";
import {Ydb} from "ydb-sdk-proto";
import {SimpleLogger} from "../../../logger/simple-logger";
import {Context} from "../../../context";

require('dotenv').config();

const DATABASE = '/local';
const ENDPOINT = process.env.YDB_ENDPOINT || 'grpc://localhost:2136';

async function main() {
    const db = new YDB({
        endpoint: ENDPOINT,
        database: DATABASE,
        authService: new AnonymousAuthService(),
        logger: new SimpleLogger({envKey: 'YDB_TEST_LOG_LEVEL'}),
    });
    if (!(await db.ready(3000))) throw new Error('Driver is not ready!');
    await db.topic.createTopic({
        path: 'demoTopic',
        consumers: [{
            name: 'demo',
        }],
    });
    const writer = await db.topic.createWriter({
        path: 'demoTopic',
        // producerId: '...', // will be genereted automatically
        // messageGroupId: '...' // will be the same as producerId
        getLastSeqNo: true, // seqNo will be assigned automatically
    });
    await writer.sendMessages({
        codec: Ydb.Topic.Codec.CODEC_RAW,
        messages: [{
            data: Buffer.from('Hello, world'),
            uncompressedSize: 'Hello, world'.length,
        }],
    });
    const promises = [];
    for (let n = 0; n < 4; n++) {
        // ((writer as any).innerWriteStream as TopicWriteStreamWithEvents).close(Context.createNew().ctx, new Error('Fake error'));

        // await sleep(3000); // TODO:

        promises.push(writer.sendMessages({
            codec: Ydb.Topic.Codec.CODEC_RAW,
            messages: [{
                data: Buffer.from(`Message N${n}`),
                uncompressedSize: `Message N${n}`.length,
            }],
        }));
    }
    await Promise.all(promises);
    const reader = await db.topic.createReader(Context.createNew({
        timeout: 3000,
    }).ctx, {
        topicsReadSettings: [{
            path: 'demoTopic',
        }],
        consumer: 'demo',
        receiveBufferSizeInBytes: 10_000_000,
    });
    for await (const message of reader.messages) {
        console.info(`Message: ${message.data!.toString()}`);
        await message.commit();
    }
    await reader.close(); // graceful close() - complete when all messages are commited
}

main();
