import Driver from '../../../driver';
import { Types } from '../../../types';
import {
    AlterTableDescription,
    AlterTableSettings,
    Column,
    OperationParams,
    TableDescription,
    TableIndex
} from "../../../table";
import {initDriver, destroyDriver} from "../../../utils/test";

const getTableName = () => `table_alter_${Math.trunc(1000 * Math.random())}`;

describe('Alter table', () => {
    let driver: Driver;
    let TABLE_NAME: string;

    beforeAll(async () => {
        driver = await initDriver();
        TABLE_NAME = getTableName();
    });

    afterAll(async () => await destroyDriver(driver));

    it('Create table', async () => {
        await driver.tableClient.withSession(async (session) => {
            await session.createTable(
                TABLE_NAME,
                new TableDescription()
                    .withColumn(new Column('id', Types.optional(Types.UINT64)))
                    .withColumn(new Column('title', Types.optional(Types.UTF8)))
                    .withPrimaryKey('id')
            );

            const createdTableDescription = await session.describeTable(TABLE_NAME);

            expect(createdTableDescription.primaryKey).toStrictEqual(['id']);
            expect(JSON.stringify(createdTableDescription.columns)).toBe(
                JSON.stringify([
                    { name: 'id', type: { optionalType: { item: { typeId: 'UINT64' } } } },
                    { name: 'title', type: { optionalType: { item: { typeId: 'UTF8' } } } },
                ])
            );
        });
    });

    it('Alter table - add columns', async () => {
        await driver.tableClient.withSession(async (session) => {
            const alterTableDescription = new AlterTableDescription();
            alterTableDescription.addColumns = [
                new Column('testBool', Types.optional(Types.BOOL)),
                new Column('testDate', Types.optional(Types.DATE)),
            ];

            await session.alterTable(TABLE_NAME, alterTableDescription);
            const alteredTableDescription = await session.describeTable(TABLE_NAME);

            expect(JSON.stringify(alteredTableDescription.columns)).toBe(
                JSON.stringify([
                    { name: 'id', type: { optionalType: { item: { typeId: 'UINT64' } } } },
                    { name: 'title', type: { optionalType: { item: { typeId: 'UTF8' } } } },
                    { name: 'testBool', type: { optionalType: { item: { typeId: 'BOOL' } } } },
                    { name: 'testDate', type: { optionalType: { item: { typeId: 'DATE' } } } },
                ])
            );
        });
    });

    it('Alter table - add indexes sync', async () => {
        await driver.tableClient.withSession(async (session) => {
            const alterTableDescription = new AlterTableDescription();

            const idxOverTestBool = new TableIndex('data_index_over_testBool')
                .withIndexColumns('testDate', 'title')
                .withDataColumns('testBool')
                .withGlobalAsync(false);
            alterTableDescription.addIndexes = [idxOverTestBool];

            await session.alterTable(
                TABLE_NAME,
                alterTableDescription,
                new AlterTableSettings().withOperationParams(new OperationParams().withSyncMode())
            );
            const alteredTableDescription = await session.describeTable(TABLE_NAME);

            expect(JSON.stringify(alteredTableDescription.indexes)).toBe(
                JSON.stringify([
                    {
                        name: 'data_index_over_testBool',
                        indexColumns: ['testDate', 'title'],
                        globalIndex: {},
                        status: 'STATUS_READY',
                        dataColumns: ['testBool'],
                    },
                ])
            );
        });
    });

    it('Alter table - drop indexes sync', async () => {
        await driver.tableClient.withSession(async (session) => {
            const alterTableDescription = new AlterTableDescription();

            alterTableDescription.dropIndexes = ['data_index_over_testBool'];

            await session.alterTable(
                TABLE_NAME,
                alterTableDescription,
                new AlterTableSettings().withOperationParams(new OperationParams().withSyncMode())
            );
            const alteredTableDescription = await session.describeTable(TABLE_NAME);

            expect(alteredTableDescription.indexes).toStrictEqual([]);
        });
    });

    it('Alter table - add indexes async', async () => {
        await driver.tableClient.withSession(async (session) => {
            const alterTableDescription = new AlterTableDescription();

            const idxOverTestBool = new TableIndex('data_index_over_testBool')
                .withIndexColumns('testDate', 'title')
                .withDataColumns('testBool')
                .withGlobalAsync(false);
            alterTableDescription.addIndexes = [idxOverTestBool];

            await session.alterTable(TABLE_NAME, alterTableDescription);
            await new Promise((resolve) => setTimeout(resolve, 200)); // wait 200ms
            const alteredTableDescription = await session.describeTable(TABLE_NAME);

            expect(JSON.stringify(alteredTableDescription.indexes)).toBe(
                JSON.stringify([
                    {
                        name: 'data_index_over_testBool',
                        indexColumns: ['testDate', 'title'],
                        globalIndex: {},
                        status: 'STATUS_READY',
                        dataColumns: ['testBool'],
                    },
                ])
            );
        });
    });

    it('Alter table - drop indexes async', async () => {
        await driver.tableClient.withSession(async (session) => {
            const alterTableDescription = new AlterTableDescription();

            alterTableDescription.dropIndexes = ['data_index_over_testBool'];

            await session.alterTable(TABLE_NAME, alterTableDescription);
            const alteredTableDescription = await session.describeTable(TABLE_NAME);

            expect(alteredTableDescription.indexes).toStrictEqual([]);
        });
    });

    // https://ydb.tech/en/docs/yql/reference/syntax/alter_table#additional-alter
    it('Alter table - alter - add attribute', async () => {
        await driver.tableClient.withSession(async (session) => {
            const alterTableDescription = new AlterTableDescription();

            alterTableDescription.alterAttributes = { AUTO_PARTITIONING_BY_SIZE: 'DISABLED' };

            await session.alterTable(TABLE_NAME, alterTableDescription);
            const alteredTableDescription = await session.describeTable(TABLE_NAME);

            expect(alteredTableDescription.attributes).toStrictEqual({ AUTO_PARTITIONING_BY_SIZE: 'DISABLED' });
        });
    });

    it('Alter table - alter - remove attribute', async () => {
        await driver.tableClient.withSession(async (session) => {
            const alterTableDescription = new AlterTableDescription();

            alterTableDescription.alterAttributes = { AUTO_PARTITIONING_BY_SIZE: '' };

            await session.alterTable(TABLE_NAME, alterTableDescription);
            const alteredTableDescription = await session.describeTable(TABLE_NAME);

            expect(alteredTableDescription.attributes).toStrictEqual({});
        });
    });
});
