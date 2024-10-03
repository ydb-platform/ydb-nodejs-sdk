import {Driver as YDB} from '../../src';
import {AnonymousAuthService} from '../../src/credentials/anonymous-auth-service';
import {SimpleLogger} from "../../src/logger/simple-logger";
import {Context} from "../../src/context";
import {TopicWriteStreamWithEvents} from "../../src/topic/internal/topic-write-stream-with-events";
import {sleep} from "../../src/utils";
// import {Ydb} from "ydb-sdk-proto";
// import {Context} from "../../src/context";

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
    try {

        db.topic;

        await db.topic.createTopic({
            path: 'demoTopic',
            consumers: [{
                name: 'demo',
            }],
        });

        const stream = new TopicWriteStreamWithEvents(Context.createNew().ctx, {
            path: 'demoTopic',
            // producerId: '...', // will be genereted automatically
            // messageGroupId: '...' // will be the same as producerId
            getLastSeqNo: true, // seqNo will be assigned automatically
        }, await (db as any).discoveryService.getTopicNodeClient(), (db as any).logger);

        stream.events.on('initResponse', (_resp) => {
            (db as any).logger.trace('TopicWriter.on "initResponse"');
        });

        stream.close(Context.createNew().ctx);

        await sleep(3000);
    } finally {
        // await db.destroy();
    }
}

main();
