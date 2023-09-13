"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_utils_1 = require("../test-utils");
const table_1 = require("../table");
const types_1 = require("../types");
const getTableName = () => `table_alter_${Math.trunc(1000 * Math.random())}`;
describe('Alter table', () => {
    let driver;
    let TABLE_NAME;
    beforeAll(async () => {
        driver = await (0, test_utils_1.initDriver)();
        TABLE_NAME = getTableName();
    });
    afterAll(async () => await (0, test_utils_1.destroyDriver)(driver));
    it('Create table', async () => {
        await driver.tableClient.withSession(async (session) => {
            await session.createTable(TABLE_NAME, new table_1.TableDescription()
                .withColumn(new table_1.Column('id', types_1.Types.optional(types_1.Types.UINT64)))
                .withColumn(new table_1.Column('title', types_1.Types.optional(types_1.Types.UTF8)))
                .withPrimaryKey('id'));
            const createdTableDescription = await session.describeTable(TABLE_NAME);
            expect(createdTableDescription.primaryKey).toStrictEqual(['id']);
            expect(JSON.stringify(createdTableDescription.columns)).toBe(JSON.stringify([
                { name: 'id', type: { optionalType: { item: { typeId: 'UINT64' } } } },
                { name: 'title', type: { optionalType: { item: { typeId: 'UTF8' } } } },
            ]));
        });
    });
    it('Alter table - add columns', async () => {
        await driver.tableClient.withSession(async (session) => {
            const alterTableDescription = new table_1.AlterTableDescription();
            alterTableDescription.addColumns = [
                new table_1.Column('testBool', types_1.Types.optional(types_1.Types.BOOL)),
                new table_1.Column('testDate', types_1.Types.optional(types_1.Types.DATE)),
            ];
            await session.alterTable(TABLE_NAME, alterTableDescription);
            const alteredTableDescription = await session.describeTable(TABLE_NAME);
            expect(JSON.stringify(alteredTableDescription.columns)).toBe(JSON.stringify([
                { name: 'id', type: { optionalType: { item: { typeId: 'UINT64' } } } },
                { name: 'title', type: { optionalType: { item: { typeId: 'UTF8' } } } },
                { name: 'testBool', type: { optionalType: { item: { typeId: 'BOOL' } } } },
                { name: 'testDate', type: { optionalType: { item: { typeId: 'DATE' } } } },
            ]));
        });
    });
    it('Alter table - add indexes sync', async () => {
        await driver.tableClient.withSession(async (session) => {
            const alterTableDescription = new table_1.AlterTableDescription();
            const idxOverTestBool = new table_1.TableIndex('data_index_over_testBool')
                .withIndexColumns('testDate', 'title')
                .withDataColumns('testBool')
                .withGlobalAsync(false);
            alterTableDescription.addIndexes = [idxOverTestBool];
            await session.alterTable(TABLE_NAME, alterTableDescription, new table_1.AlterTableSettings().withOperationParams(new table_1.OperationParams().withSyncMode()));
            const alteredTableDescription = await session.describeTable(TABLE_NAME);
            expect(JSON.stringify(alteredTableDescription.indexes)).toBe(JSON.stringify([
                {
                    name: 'data_index_over_testBool',
                    indexColumns: ['testDate', 'title'],
                    globalIndex: {},
                    status: 'STATUS_READY',
                    dataColumns: ['testBool'],
                },
            ]));
        });
    });
    it('Alter table - drop indexes sync', async () => {
        await driver.tableClient.withSession(async (session) => {
            const alterTableDescription = new table_1.AlterTableDescription();
            alterTableDescription.dropIndexes = ['data_index_over_testBool'];
            await session.alterTable(TABLE_NAME, alterTableDescription, new table_1.AlterTableSettings().withOperationParams(new table_1.OperationParams().withSyncMode()));
            const alteredTableDescription = await session.describeTable(TABLE_NAME);
            expect(alteredTableDescription.indexes).toStrictEqual([]);
        });
    });
    it('Alter table - add indexes async', async () => {
        await driver.tableClient.withSession(async (session) => {
            const alterTableDescription = new table_1.AlterTableDescription();
            const idxOverTestBool = new table_1.TableIndex('data_index_over_testBool')
                .withIndexColumns('testDate', 'title')
                .withDataColumns('testBool')
                .withGlobalAsync(false);
            alterTableDescription.addIndexes = [idxOverTestBool];
            await session.alterTable(TABLE_NAME, alterTableDescription);
            await new Promise((resolve) => setTimeout(resolve, 200)); // wait 200ms
            const alteredTableDescription = await session.describeTable(TABLE_NAME);
            expect(JSON.stringify(alteredTableDescription.indexes)).toBe(JSON.stringify([
                {
                    name: 'data_index_over_testBool',
                    indexColumns: ['testDate', 'title'],
                    globalIndex: {},
                    status: 'STATUS_READY',
                    dataColumns: ['testBool'],
                },
            ]));
        });
    });
    it('Alter table - drop indexes async', async () => {
        await driver.tableClient.withSession(async (session) => {
            const alterTableDescription = new table_1.AlterTableDescription();
            alterTableDescription.dropIndexes = ['data_index_over_testBool'];
            await session.alterTable(TABLE_NAME, alterTableDescription);
            const alteredTableDescription = await session.describeTable(TABLE_NAME);
            expect(alteredTableDescription.indexes).toStrictEqual([]);
        });
    });
    // https://ydb.tech/en/docs/yql/reference/syntax/alter_table#additional-alter
    it('Alter table - alter - add attribute', async () => {
        await driver.tableClient.withSession(async (session) => {
            const alterTableDescription = new table_1.AlterTableDescription();
            alterTableDescription.alterAttributes = { AUTO_PARTITIONING_BY_SIZE: 'DISABLED' };
            await session.alterTable(TABLE_NAME, alterTableDescription);
            const alteredTableDescription = await session.describeTable(TABLE_NAME);
            expect(alteredTableDescription.attributes).toStrictEqual({ AUTO_PARTITIONING_BY_SIZE: 'DISABLED' });
        });
    });
    it('Alter table - alter - remove attribute', async () => {
        await driver.tableClient.withSession(async (session) => {
            const alterTableDescription = new table_1.AlterTableDescription();
            alterTableDescription.alterAttributes = { AUTO_PARTITIONING_BY_SIZE: '' };
            await session.alterTable(TABLE_NAME, alterTableDescription);
            const alteredTableDescription = await session.describeTable(TABLE_NAME);
            expect(alteredTableDescription.attributes).toStrictEqual({});
        });
    });
});
