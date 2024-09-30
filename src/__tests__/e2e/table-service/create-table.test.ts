if (process.env.TEST_ENVIRONMENT === 'dev') require('dotenv').config();
import Driver from '../../../driver';
import {TypedValues, Types} from '../../../types';
import Long from 'long';
import {Ydb} from 'ydb-sdk-proto';
import {Column, DescribeTableSettings, TableDescription} from "../../../table";
import {initDriver, destroyDriver} from "../../../utils/test";

if (process.env.TEST_ENVIRONMENT === 'dev') require('dotenv').config();

const getTableName = () => `table_create_${Math.trunc(100000 * Math.random())}`;

describe('Create table', () => {
    let driver: Driver;
    let getBaseTableDesc = () => {
        const td = new TableDescription()
            .withColumn(new Column('id', Types.optional(Types.UINT64)))
            .withColumn(new Column('title', Types.optional(Types.UTF8), 'title_time'))
            .withColumn(new Column('time', Types.optional(Types.TIMESTAMP), 'title_time'))
            .withPrimaryKey('id');
        return td;
    };

    beforeAll(async () => {
        driver = await initDriver();
    });

    afterAll(async () => await destroyDriver(driver));

    it('Simple usage with indexes', async () => {
        await driver.tableClient.withSession(async (session) => {
            const tableName = getTableName();
            await session.createTable(tableName, getBaseTableDesc());

            const createdTableDescription = await session.describeTable(tableName);

            expect(createdTableDescription.primaryKey).toStrictEqual(['id']);
            expect(JSON.stringify(createdTableDescription.columns)).toBe(
                JSON.stringify([
                    {name: 'id', type: {optionalType: {item: {typeId: 'UINT64'}}}},
                    {
                        name: 'title',
                        type: {optionalType: {item: {typeId: 'UTF8'}}},
                        family: 'title_time',
                    },
                    {
                        name: 'time',
                        type: {optionalType: {item: {typeId: 'TIMESTAMP'}}},
                        family: 'title_time',
                    },
                ]),
            );
        });
    });

    it('TTLSettings and uniformPartitions', async () => {
        const tableDescription = getBaseTableDesc().withTtl('time', 314);
        tableDescription.uniformPartitions = 10;
        const tableName = getTableName();
        await driver.tableClient.withSession(async (session) => {
            await session.createTable(tableName, tableDescription);
            const createdTableDescription = await session.describeTable(
                tableName,
                new DescribeTableSettings().withIncludeTableStats(true),
            );

            expect(JSON.parse(JSON.stringify(createdTableDescription.ttlSettings))).toStrictEqual({
                dateTypeColumn: {
                    columnName: 'time',
                    expireAfterSeconds: 314,
                },
            });
            expect(createdTableDescription.tableStats?.partitions).toStrictEqual(
                new Long(10, undefined, true),
            );
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
            partitioningByLoad: Ydb.FeatureFlag.Status.ENABLED,
            partitioningBySize: Ydb.FeatureFlag.Status.ENABLED,
            partitionSizeMb: 1024,
        };
        tableDescription.uniformPartitions = 50;
        tableDescription.attributes = {TEST_MY_ATTR: 'TRRUUUEEEE'};
        const tableName = getTableName();
        await driver.tableClient.withSession(async (session) => {
            await session.createTable(tableName, tableDescription);
            const createdTableDescription = await session.describeTable(
                tableName,
                new DescribeTableSettings().withIncludeTableStats(true),
            );

            expect(createdTableDescription.attributes).toStrictEqual({TEST_MY_ATTR: 'TRRUUUEEEE'});
            expect(
                JSON.parse(JSON.stringify(createdTableDescription.partitioningSettings)),
            ).toStrictEqual({
                maxPartitionsCount: '2222',
                minPartitionsCount: '111',
                partitionSizeMb: '1024',
                partitioningByLoad: 'ENABLED',
                partitioningBySize: 'ENABLED',
            });
            expect(createdTableDescription.tableStats?.partitions).toStrictEqual(
                new Long(50, undefined, true),
            );
        });
    });

    it('columnFamilies', async () => {
        const tableDescription = getBaseTableDesc();
        tableDescription.columnFamilies = [
            {
                name: 'title_time',
                compression: Ydb.Table.ColumnFamily.Compression.COMPRESSION_LZ4,
                // keepInMemory: Ydb.FeatureFlag.Status.ENABLED, // impossible to check for now
                data: {media: 'hdd'}, // impossible to check for now
            },
        ];
        const tableName = getTableName();
        await driver.tableClient.withSession(async (session) => {
            await session.createTable(tableName, tableDescription);
            const createdTableDescription = await session.describeTable(tableName);

            expect(
                JSON.parse(JSON.stringify(createdTableDescription.columnFamilies)),
            ).toStrictEqual([
                {compression: 'COMPRESSION_NONE', name: 'default'},
                {
                    compression: 'COMPRESSION_LZ4',
                    name: 'title_time',
                    data: {media: 'hdd'},
                },
            ]);
        });
    });

    it('storageSettings, readReplicasSettings and keyBloomFilter', async () => {
        const tableDescription = getBaseTableDesc();
        // tableDescription.compactionPolicy = 'default'; // impossible to check for now
        tableDescription.storageSettings = {
            external: {media: 'hdd'},
            tabletCommitLog0: {media: 'hdd'},
            tabletCommitLog1: {media: 'hdd'},
        };
        tableDescription.readReplicasSettings = {
            perAzReadReplicasCount: 2,
        };
        tableDescription.keyBloomFilter = Ydb.FeatureFlag.Status.ENABLED;
        const tableName = getTableName();
        await driver.tableClient.withSession(async (session) => {
            await session.createTable(tableName, tableDescription);

            const createdTableDescription = await session.describeTable(tableName);
            expect(
                JSON.parse(JSON.stringify(createdTableDescription.storageSettings)),
            ).toStrictEqual({
                external: {media: 'hdd'},
                storeExternalBlobs: 'DISABLED',
                tabletCommitLog0: {media: 'hdd'},
                tabletCommitLog1: {media: 'hdd'},
            });
            expect(JSON.stringify(createdTableDescription.readReplicasSettings)).toStrictEqual(
                '{"perAzReadReplicasCount":"2"}',
            );
            expect(createdTableDescription.keyBloomFilter).toStrictEqual(
                Ydb.FeatureFlag.Status.ENABLED,
            );
        });
    });

    it('partitionAtKeys and readReplicasSettings', async () => {
        const tableDescription = getBaseTableDesc();
        tableDescription.partitionAtKeys = {
            splitPoints: [
                TypedValues.tuple(TypedValues.optional(TypedValues.uint64(10))),
                TypedValues.tuple(TypedValues.optional(TypedValues.uint64(30))),
                TypedValues.tuple(TypedValues.optional(TypedValues.uint64(50))),
                TypedValues.tuple(TypedValues.optional(TypedValues.uint64(60))),
                TypedValues.tuple(TypedValues.optional(TypedValues.uint64(70))),
                TypedValues.tuple(TypedValues.optional(TypedValues.uint64(80))),
                TypedValues.tuple(TypedValues.optional(TypedValues.uint64(90))),
            ],
        };
        const tableName = getTableName();
        await driver.tableClient.withSession(async (session) => {
            await session.createTable(tableName, tableDescription);

            const createdTableDescription = await session.describeTable(
                tableName,
                new DescribeTableSettings().withIncludeTableStats(true),
            );
            expect(createdTableDescription.tableStats?.partitions).toStrictEqual(
                new Long(8, undefined, true),
            );
        });
    });
});
