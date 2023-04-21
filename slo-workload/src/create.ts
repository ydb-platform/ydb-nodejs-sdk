import { Column, Driver, ExecuteQuerySettings, TableDescription, Types, Ydb } from 'ydb-sdk'

import {
  TABLE_NAME,
  TABLE_MIN_PARTITION_COUNT,
  TABLE_MAX_PARTITION_COUNT,
  GENERATOR_DATA_COUNT,
  TABLE_PARTITION_SIZE,
  GENERATOR_PACK_SIZE,
} from './utils/defaults'
import { QueryBuilder } from './utils/QueryBuilder'
import { DataGenerator } from './utils/DataGenerator'

export async function create(
  driver: Driver,
  tableName?: string,
  _minPartitionsCount?: string,
  _maxPartitionsCount?: string,
  _partitionSize?: string,
  _dataCount?: string
) {
  if (!tableName) tableName = TABLE_NAME

  let minPartitionsCount: number = TABLE_MIN_PARTITION_COUNT
  let maxPartitionsCount: number = TABLE_MAX_PARTITION_COUNT
  let partitionSize: number = TABLE_PARTITION_SIZE

  if (_minPartitionsCount) minPartitionsCount = parseIntNumber(_minPartitionsCount)
  if (_maxPartitionsCount) maxPartitionsCount = parseIntNumber(_maxPartitionsCount)
  if (_partitionSize) partitionSize = parseIntNumber(_partitionSize)

  let dataCount: number = GENERATOR_DATA_COUNT
  if (_dataCount) dataCount = parseIntNumber(_dataCount)

  await createTable(driver, tableName, minPartitionsCount, maxPartitionsCount, partitionSize)
  await generateInitialContent(driver, tableName, dataCount)

  process.exit(0)
}

function parseIntNumber(numberCandidate: string): number {
  const n = Number(numberCandidate)
  if (isNaN(n)) throw Error('Not a number')
  return Math.floor(n)
}

async function createTable(
  driver: Driver,
  tableName: string,
  minPartitionsCount: number,
  maxPartitionsCount: number,
  partitionSize: number
) {
  console.log('Create table', {
    task: 'createTable',
    tableName,
    minPartitionsCount,
    maxPartitionsCount,
    partitionSize,
  })

  await driver.tableClient.withSession(async (session) => {
    const tableDescription = new TableDescription()
      .withColumn(new Column('hash', Types.optional(Types.UINT64)))
      .withColumn(new Column('id', Types.optional(Types.UINT64)))
      .withColumn(new Column('payload_str', Types.optional(Types.UTF8)))
      .withColumn(new Column('payload_double', Types.optional(Types.DOUBLE)))
      .withColumn(new Column('payload_timestamp', Types.optional(Types.TIMESTAMP)))
      .withColumn(new Column('payload_hash', Types.optional(Types.UINT64)))
      .withPrimaryKeys('hash', 'id')

    tableDescription.partitioningSettings = {
      minPartitionsCount: minPartitionsCount,
      maxPartitionsCount: maxPartitionsCount,
      partitionSizeMb: partitionSize,
      partitioningBySize: Ydb.FeatureFlag.Status.ENABLED,
    }

    await session.createTable(tableName, tableDescription)
    console.log('Table created')
  })
}

async function generateInitialContent(driver: Driver, tableName: string, count: number) {
  console.log('Generate initial content', { task: 'generateInitialContent', tableName, count })

  const count5p = Math.floor(count / 20) // every 5% of count for logs

  const qb = new QueryBuilder(tableName, 10, 10) // stub timeouts
  DataGenerator.setMaxId(0)

  await Promise.all(
    Array.apply(null, Array(count)).map(() => {
      return driver.tableClient.withSession(async (session) => {
        await session.executeQuery(
          qb.writeQuery,
          { ...DataGenerator.getUpsertData() },
          { commitTx: true, beginTx: { serializableReadWrite: {} } },
          new ExecuteQuerySettings().withKeepInCache(true)
        )
      }, 10000)
    })
  )
  console.log('Initial content generated')
}
