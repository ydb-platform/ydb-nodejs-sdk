import {
  Column,
  Driver,
  ExecuteQuerySettings,
  PartitioningPolicy,
  TableDescription,
  TableProfile,
  TypedData,
  Types,
} from 'ydb-sdk'

import { PackGenerator } from './utils/PackGenerator'
import { StructValue } from './utils/StructValue'
import {
  TABLE_NAME,
  TABLE_MIN_PARTITION_COUNT,
  TABLE_MAX_PARTITION_COUNT,
  GENERATOR_DATA_COUNT,
  GENERATOR_PACK_SIZE,
  TABLE_PARTITION_SIZE,
} from './utils/defaults'

export async function create(
  driver: Driver,
  db: string,
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
      .withColumn(new Column('object_id_key', Types.optional(Types.UINT32)))
      .withColumn(new Column('object_id', Types.optional(Types.UINT32)))
      .withColumn(new Column('timestamp', Types.optional(Types.UINT64)))
      .withColumn(new Column('payload', Types.optional(Types.UTF8)))
      .withPrimaryKeys('object_id_key', 'object_id')

    tableDescription.partitioningSettings = {
      minPartitionsCount: minPartitionsCount,
      maxPartitionsCount: maxPartitionsCount,
      partitionSizeMb: partitionSize,
    }

    await session.createTable(tableName, tableDescription)
    console.log('Table created')
  })
}

async function generateInitialContent(driver: Driver, tableName: string, count: number) {
  console.log('Generate initial content', { task: 'generateInitialContent', tableName, count })
  const generator = new PackGenerator(count, GENERATOR_PACK_SIZE, 0)

  const query = `--!syntax_v1
    DECLARE $items AS
    List<Struct<
    object_id_key: Uint32,
    object_id: Uint32,
    timestamp: Uint64,
    payload: Utf8>>;
    UPSERT INTO \`${tableName}\`
    SELECT * FROM AS_TABLE($items);`

  let batch: StructValue[]
  while ((batch = generator.get()).length > 0) {
    // TODO: add executor
    await driver.tableClient.withSession(async (session) => {
      await session.executeQuery(
        query,
        { $items: TypedData.asTypedCollection(batch) },
        { commitTx: true, beginTx: { serializableReadWrite: {} } },
        new ExecuteQuerySettings().withKeepInCache(true)
      )
    }, 10000)
    console.log(`Successfully inserted ${batch.length} rows`)
  }
  console.log('Initial content generated')
}
