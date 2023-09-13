"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const test_utils_1 = require("../test-utils");
const table_1 = require("../table");
const types_1 = require("../types");
const long_1 = __importDefault(require("long"));
const ydb_sdk_proto_1 = require("ydb-sdk-proto");
const getTableName = () => `table_create_${Math.trunc(100000 * Math.random())}`;
describe('Create table', () => {
    let driver;
    let getBaseTableDesc = () => {
        const td = new table_1.TableDescription()
            .withColumn(new table_1.Column('id', types_1.Types.optional(types_1.Types.UINT64)))
            .withColumn(new table_1.Column('title', types_1.Types.optional(types_1.Types.UTF8), 'title_time'))
            .withColumn(new table_1.Column('time', types_1.Types.optional(types_1.Types.TIMESTAMP), 'title_time'))
            .withPrimaryKey('id');
        return td;
    };
    beforeAll(async () => {
        driver = await (0, test_utils_1.initDriver)();
    });
    afterAll(async () => await (0, test_utils_1.destroyDriver)(driver));
    it('Simple usage with indexes', async () => {
        await driver.tableClient.withSession(async (session) => {
            const tableName = getTableName();
            await session.createTable(tableName, getBaseTableDesc());
            const createdTableDescription = await session.describeTable(tableName);
            expect(createdTableDescription.primaryKey).toStrictEqual(['id']);
            expect(JSON.stringify(createdTableDescription.columns)).toBe(JSON.stringify([
                { name: 'id', type: { optionalType: { item: { typeId: 'UINT64' } } } },
                {
                    name: 'title',
                    type: { optionalType: { item: { typeId: 'UTF8' } } },
                    family: 'title_time',
                },
                {
                    name: 'time',
                    type: { optionalType: { item: { typeId: 'TIMESTAMP' } } },
                    family: 'title_time',
                },
            ]));
        });
    });
    it('TTLSettings and uniformPartitions', async () => {
        const tableDescription = getBaseTableDesc().withTtl('time', 314);
        tableDescription.uniformPartitions = 10;
        const tableName = getTableName();
        await driver.tableClient.withSession(async (session) => {
            var _a;
            await session.createTable(tableName, tableDescription);
            const createdTableDescription = await session.describeTable(tableName, new table_1.DescribeTableSettings().withIncludeTableStats(true));
            expect(JSON.parse(JSON.stringify(createdTableDescription.ttlSettings))).toStrictEqual({
                dateTypeColumn: {
                    columnName: 'time',
                    expireAfterSeconds: 314,
                },
            });
            expect((_a = createdTableDescription.tableStats) === null || _a === void 0 ? void 0 : _a.partitions).toStrictEqual(new long_1.default(10, undefined, true));
        });
    });
    // somehow YDB normally combines min/max partitions with setted by uniform
    // and uses it as initial amount of partitions
    it('partitioningSettings', async () => {
        const tableDescription = getBaseTableDesc();
        tableDescription.partitioningSettings = {
            maxPartitionsCount: 2222,
            minPartitionsCount: 111,
            partitionBy: ['id'],
            partitioningByLoad: ydb_sdk_proto_1.Ydb.FeatureFlag.Status.ENABLED,
            partitioningBySize: ydb_sdk_proto_1.Ydb.FeatureFlag.Status.ENABLED,
            partitionSizeMb: 1024,
        };
        tableDescription.uniformPartitions = 50;
        tableDescription.attributes = { TEST_MY_ATTR: 'TRRUUUEEEE' };
        const tableName = getTableName();
        await driver.tableClient.withSession(async (session) => {
            var _a;
            await session.createTable(tableName, tableDescription);
            const createdTableDescription = await session.describeTable(tableName, new table_1.DescribeTableSettings().withIncludeTableStats(true));
            expect(createdTableDescription.attributes).toStrictEqual({ TEST_MY_ATTR: 'TRRUUUEEEE' });
            expect(JSON.parse(JSON.stringify(createdTableDescription.partitioningSettings))).toStrictEqual({
                maxPartitionsCount: '2222',
                minPartitionsCount: '111',
                partitionSizeMb: '1024',
                partitioningByLoad: 'ENABLED',
                partitioningBySize: 'ENABLED',
            });
            expect((_a = createdTableDescription.tableStats) === null || _a === void 0 ? void 0 : _a.partitions).toStrictEqual(new long_1.default(50, undefined, true));
        });
    });
    it('columnFamilies', async () => {
        const tableDescription = getBaseTableDesc();
        tableDescription.columnFamilies = [
            {
                name: 'title_time',
                compression: ydb_sdk_proto_1.Ydb.Table.ColumnFamily.Compression.COMPRESSION_LZ4,
                // keepInMemory: Ydb.FeatureFlag.Status.ENABLED, // impossible to check for now
                data: { media: 'hdd' }, // impossible to check for now
            },
        ];
        const tableName = getTableName();
        await driver.tableClient.withSession(async (session) => {
            await session.createTable(tableName, tableDescription);
            const createdTableDescription = await session.describeTable(tableName);
            expect(JSON.parse(JSON.stringify(createdTableDescription.columnFamilies))).toStrictEqual([
                { compression: 'COMPRESSION_NONE', name: 'default' },
                {
                    compression: 'COMPRESSION_LZ4',
                    name: 'title_time',
                    data: { media: 'hdd' },
                },
            ]);
        });
    });
    it('storageSettings, readReplicasSettings and keyBloomFilter', async () => {
        const tableDescription = getBaseTableDesc();
        // tableDescription.compactionPolicy = 'default'; // impossible to check for now
        tableDescription.storageSettings = {
            external: { media: 'hdd' },
            tabletCommitLog0: { media: 'hdd' },
            tabletCommitLog1: { media: 'hdd' },
        };
        tableDescription.readReplicasSettings = {
            perAzReadReplicasCount: 2,
        };
        tableDescription.keyBloomFilter = ydb_sdk_proto_1.Ydb.FeatureFlag.Status.ENABLED;
        const tableName = getTableName();
        await driver.tableClient.withSession(async (session) => {
            await session.createTable(tableName, tableDescription);
            const createdTableDescription = await session.describeTable(tableName);
            expect(JSON.parse(JSON.stringify(createdTableDescription.storageSettings))).toStrictEqual({
                external: { media: 'hdd' },
                storeExternalBlobs: 'DISABLED',
                tabletCommitLog0: { media: 'hdd' },
                tabletCommitLog1: { media: 'hdd' },
            });
            expect(JSON.stringify(createdTableDescription.readReplicasSettings)).toStrictEqual('{"perAzReadReplicasCount":"2"}');
            expect(createdTableDescription.keyBloomFilter).toStrictEqual(ydb_sdk_proto_1.Ydb.FeatureFlag.Status.ENABLED);
        });
    });
    it('partitionAtKeys and readReplicasSettings', async () => {
        const tableDescription = getBaseTableDesc();
        tableDescription.partitionAtKeys = {
            splitPoints: [
                types_1.TypedValues.tuple(types_1.TypedValues.optional(types_1.TypedValues.uint64(10))),
                types_1.TypedValues.tuple(types_1.TypedValues.optional(types_1.TypedValues.uint64(30))),
                types_1.TypedValues.tuple(types_1.TypedValues.optional(types_1.TypedValues.uint64(50))),
                types_1.TypedValues.tuple(types_1.TypedValues.optional(types_1.TypedValues.uint64(60))),
                types_1.TypedValues.tuple(types_1.TypedValues.optional(types_1.TypedValues.uint64(70))),
                types_1.TypedValues.tuple(types_1.TypedValues.optional(types_1.TypedValues.uint64(80))),
                types_1.TypedValues.tuple(types_1.TypedValues.optional(types_1.TypedValues.uint64(90))),
            ],
        };
        const tableName = getTableName();
        await driver.tableClient.withSession(async (session) => {
            var _a;
            await session.createTable(tableName, tableDescription);
            const createdTableDescription = await session.describeTable(tableName, new table_1.DescribeTableSettings().withIncludeTableStats(true));
            expect((_a = createdTableDescription.tableStats) === null || _a === void 0 ? void 0 : _a.partitions).toStrictEqual(new long_1.default(8, undefined, true));
        });
    });
});
