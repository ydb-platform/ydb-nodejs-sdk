import {
    getCredentialsFromEnv,
    Driver,
    Logger,
    TableDescription,
    ReadTableSettings,
    Column,
    Ydb,
    Session,
    withRetries,
} from 'ydb-sdk';
import {getOrdersData, Order} from "./data-helpers";
import {main, SYNTAX_V1} from "../utils";

const TABLE_NAME = 'orders';

async function createTable(session: Session, logger: Logger) {
    logger.info('Dropping old table...');
    await session.dropTable(TABLE_NAME);

    logger.info('Creating table...');
    await session.createTable(
        TABLE_NAME,
        new TableDescription()
            .withColumn(new Column(
                'customer_id',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UINT64}}})
            ))
            .withColumn(new Column(
                'order_id',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UINT64}}})
            ))
            .withColumn(new Column(
                'description',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UTF8}}})
            ))
            .withColumn(new Column(
                'order_date',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.DATE}}})
            ))
            .withPrimaryKeys('customer_id', 'order_id')
    );
}

async function fillTableWithData(tablePathPrefix: string, session: Session, logger: Logger) {
    const query = `
${SYNTAX_V1}
PRAGMA TablePathPrefix("${tablePathPrefix}");

DECLARE $ordersData AS List<Struct<
    customer_id: Uint64,
    order_id: Uint64,
    description: Utf8,
    order_date: Date>>;

REPLACE INTO ${TABLE_NAME}
SELECT
    customer_id,
    order_id,
    description,
    order_date
FROM AS_TABLE($ordersData);`;

    async function fillTable() {
        logger.info('Inserting data to table, preparing query...');
        const preparedQuery = await session.prepareQuery(query);
        logger.info('Query has been prepared, executing...');
        await session.executeQuery(preparedQuery, {'$ordersData': getOrdersData()});
    }
    await withRetries(fillTable);
}

async function readTable(tablePathPrefix: string, session: Session, logger: Logger, settings?: ReadTableSettings): Promise<void> {
    await session.streamReadTable(tablePathPrefix + '/' + TABLE_NAME, (result) => {
        const resultSet = result.resultSet;
        if (resultSet) {
            const orders = Order.createNativeObjects(resultSet) as Order[];
            orders.forEach((order) => {
               logger.info(`#  Order, CustomerId: ${order.customerId}, OrderId: ${order.orderId}, Description: ${order.description}, Order date: ${order.orderDate}`)
            });
        }
    }, settings);
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
        await fillTableWithData(dbName, session, logger);
    });
    await driver.tableClient.withSession(async (session) => {
        logger.info('Read whole table, unsorted:');
        await readTable(dbName, session, logger);

        logger.info('Sorted by composite primary key:');
        await readTable(dbName, session, logger, new ReadTableSettings().withOrdered(true));

        logger.info('Any five rows:');
        await readTable(dbName, session, logger, new ReadTableSettings().withRowLimit(5));

        logger.info('First five rows by PK (ascending) with subset of columns:');
        await readTable(dbName, session, logger, new ReadTableSettings()
            .withRowLimit(5)
            .withColumns('customer_id', 'order_id', 'order_date')
            .withOrdered(true));
    });
    await driver.destroy();
}

main(run);
