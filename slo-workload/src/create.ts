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
  TABLE_PARTITION_COUNT,
  GENERATOR_DATA_COUNT,
  GENERATOR_PACK_SIZE,
} from './utils/defaults'

export async function create(
  driver: Driver,
  db: string,
  tableName?: string,
  _partitionsCount?: string,
  _dataCount?: string
) {
  if (!tableName) tableName = TABLE_NAME

  let partitionsCount: number = TABLE_PARTITION_COUNT
  if (_partitionsCount) {
    partitionsCount = parseIntNumber(_partitionsCount)
    partitionsCount = Math.floor(partitionsCount)
  }

  let dataCount: number = GENERATOR_DATA_COUNT
  if (_dataCount) {
    dataCount = parseIntNumber(_dataCount)
    dataCount = Math.floor(dataCount)
  }

  await createTable(driver, tableName, partitionsCount)
  await generateInitialContent(driver, tableName, dataCount)

  process.exit(0)
}

function parseIntNumber(numberCandidate: string): number {
  const n = Number(numberCandidate)
  if (isNaN(n)) throw Error('Not a number')
  return n
}

async function createTable(driver: Driver, tableName: string, partitions: number) {
  console.log('Create table', { task: 'createTable', tableName, partitions })
  await driver.tableClient.withSession(async (session) => {
    const profile = new TableProfile().withPartitioningPolicy(
      new PartitioningPolicy().withUniformPartitions(partitions)
    )
    const tableDescription = new TableDescription()
      .withColumn(new Column('object_id_key', Types.optional(Types.UINT32)))
      .withColumn(new Column('object_id', Types.optional(Types.UINT32)))
      .withColumn(new Column('timestamp', Types.optional(Types.UINT64)))
      .withColumn(new Column('payload', Types.optional(Types.UTF8)))
      .withPrimaryKeys('object_id_key', 'object_id')
      .withProfile(profile)

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
