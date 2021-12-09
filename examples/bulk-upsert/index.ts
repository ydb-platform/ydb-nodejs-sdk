import {
    Column,
    Driver,
    getCredentialsFromEnv,
    Logger,
    Session,
    TableDescription,
    Ydb
} from 'ydb-sdk';
import {main} from '../utils';
import {LogMessage} from './data-helpers';

const TABLE_NAME = 'log_messages';
const BATCH_SIZE = 1000;

const now = Date.now();

function getLogBatch(offset: number): LogMessage[] {
    const logs = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
        const message = LogMessage.create(
            `App_${Math.trunc(i / 256)}`,
            `192.168.0.${offset % 256}`,
            new Date(now + offset * 1000 + i % 1000),
            200,
            i % 2 === 0 ? "GET / HTTP/1.1" : "GET /images/logo.png HTTP/1.1",
        );
        logs.push(message);
    }
    return logs;
}

async function createTable(session: Session, logger: Logger) {
    logger.info('Dropping old table...');
    await session.dropTable(TABLE_NAME);

    logger.info('Creating table...');
    await session.createTable(
        TABLE_NAME,
        new TableDescription()
            .withColumn(new Column(
                'app',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UTF8}}})
            ))
            .withColumn(new Column(
                'timestamp',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.TIMESTAMP}}})
            ))
            .withColumn(new Column(
                'host',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UTF8}}})
            ))
            .withColumn(new Column(
                'http_code',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UINT32}}})
            ))
            .withColumn(new Column(
                'message',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UTF8}}})
            ))
            .withPrimaryKeys('app', 'timestamp', 'host')
    );
}

async function writeLogBatch(dbName: string, session: Session, logs: LogMessage[]) {
    const rows = LogMessage.asTypedCollection(logs) as Ydb.TypedValue;
    return await session.bulkUpsert(`${dbName}/${TABLE_NAME}`, rows);
}

async function run(logger: Logger, entryPoint: string, dbName: string) {
    const authService = getCredentialsFromEnv(entryPoint, dbName, logger);
    logger.info('Driver initializing...');
    const driver = new Driver(entryPoint, dbName, authService);
    const timeout = 10000;
    if (!await driver.ready(timeout)) {
        logger.fatal(`Driver has not become ready in ${timeout}ms!`);
        process.exit(1);
    }
    await driver.tableClient.withSession(async (session) => {
        await createTable(session, logger);
        for (let offset = 0; offset < 1000; offset++) {
            const logs = getLogBatch(offset);
            logger.info(`Write log batch with offset ${offset}`);
            await writeLogBatch(dbName, session, logs);
        }
        logger.info('Done');
    });
    await driver.destroy();
}

main(run);
