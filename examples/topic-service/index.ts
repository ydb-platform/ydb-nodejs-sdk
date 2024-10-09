import {Driver as YDB, getCredentialsFromEnv} from '../../src';
import {Ydb} from "ydb-sdk-proto";
import {Context} from "../../src/context";
import {getDefaultLogger} from "../../src/logger/get-default-logger";
import {main} from "../utils";
import Codec = Ydb.Topic.Codec;

require('dotenv').config();

const DATABASE = '/local';
const ENDPOINT = process.env.YDB_ENDPOINT || 'grpc://localhost:2136';

async function run() {
    const logger = getDefaultLogger();
    const authService = getCredentialsFromEnv(logger);
    const db = new YDB({
        endpoint: ENDPOINT, // i.e.: grc(s)://<x.x.x.x>
        database: DATABASE, // i.e.: '/local'
        authService, logger
        // logger: new SimpleLogger({envKey: 'YDB_TEST_LOG_LEVEL'}),
    });
    if (!(await db.ready(3000))) throw new Error('Driver is not ready!');
    try {
        await db.topic.createTopic({
            path: 'demoTopic',
            supportedCodecs: {
                codecs: [Ydb.Topic.Codec.CODEC_RAW],
            },
            partitioningSettings: {
                minActivePartitions: 3,
            },
            consumers: [{
                name: 'demoConsumer',
            }],
        });

        await db.topic.alterTopic({
            path: 'demoTopic',
            addConsumers: [{
                name: 'anotherqDemoConsumer',
            }],
            setSupportedCodecs: {
                codecs: [Ydb.Topic.Codec.CODEC_RAW, Codec.CODEC_GZIP],
            },
        });

        logger.info(await db.topic.describeTopic({
            path: 'demoTopic',
        }));

        const writer = await db.topic.createWriter({
            path: 'demoTopic',
            // producerId: '...', // will be genereted automatically
            // messageGroupId: '...' // will be the same as producerId
            getLastSeqNo: true, // seqNo will be assigned automatically
        });
        await writer.send({
            codec: Ydb.Topic.Codec.CODEC_RAW,
            messages: [{
                data: Buffer.from('Hello, world'),
                uncompressedSize: 'Hello, world'.length,
            }],
        });
        const promises = [];
        for (let n = 0; n < 4; n++) {
            promises.push(writer.send({
                codec: Ydb.Topic.Codec.CODEC_RAW,
                messages: [{
                    data: Buffer.from(`Message N${n}`),
                    uncompressedSize: `Message N${n}`.length,
                    metadataItems: [
                        {
                            key: 'key',
                            value: new TextEncoder().encode('value'),
                        },
                        {
                            key: 'key2',
                            value: new TextEncoder().encode('value2'),
                        }
                    ],
                }],
           }));
        }
        await writer.close(); // // graceful close() - will finish after receiving confirmation that all messages have been processed by the server
        // await Promise.all(promises); // another option

        const reader = await db.topic.createReader(Context.createNew({
            timeout: 3000,
        }).ctx, {
            topicsReadSettings: [{
                path: 'demoTopic',
            }],
            consumer: 'demoConsumer',
            receiveBufferSizeInBytes: 10_000_000,
        });
        try {
            for await (const message of reader.messages) {
                console.info(`Message: ${message.data!.toString()}`);
                await message.commit();
            }
        } catch (err) {
            if (!Context.isTimeout(err)) throw err;
            console.info('Timeout is over!');
        }
        await reader.close(); // graceful close() - will complete when processing of all currently processed messages will finish

        await db.topic.dropTopic({
            path: 'demoTopic',
        });

    } finally {
        await db.destroy();
    }
}

main(run);