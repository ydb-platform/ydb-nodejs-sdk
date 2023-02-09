import { ExecuteQuerySettings, OperationParams, TypedValues } from 'ydb-sdk'

import { READ_RPS, READ_TIMEOUT, READ_TIME } from './utils/defaults'
import RateLimiter from './utils/RateLimiter'
import { randomId } from './utils/DataGenerator'
import Executor from './utils/Executor'

export async function readJob(
  executor: Executor,
  tableName: string,
  maxId: number,
  readRPS?: number,
  readTimeout?: number,
  time?: number
) {
  if (!readRPS) readRPS = READ_RPS
  if (!readTimeout) readTimeout = READ_TIMEOUT
  if (!time) time = READ_TIME

  const rateLimiter = new RateLimiter('read', readRPS)
  await read(
    executor,
    rateLimiter,
    maxId,
    tableName,
    new Date().valueOf() + time * 1000,
    readTimeout
  )
}

async function read(
  executor: Executor,
  rl: RateLimiter,
  maxId: number,
  tableName: string,
  stopTime: number,
  timeout: number
) {
  console.log('Read with params', { maxId, tableName, stopTime })
  // PRAGMA TablePathPrefix(" + dbName + ");
  const query = `--!syntax_v1
    DECLARE $object_id_key AS Uint32;
    DECLARE $object_id AS Uint32;
    SELECT * FROM \`${tableName}\`
    WHERE object_id_key = $object_id_key AND object_id = $object_id;`

  const settings = new ExecuteQuerySettings().withKeepInCache(true).withOperationParams(
    new OperationParams().withOperationTimeout({
      nanos: timeout * 1000 * 1000,
    })
  )
  const startTime = new Date()
  let counter = 0
  const withSession = executor.withSession('read')
  while (new Date().valueOf() < stopTime) {
    const id = randomId(maxId)
    counter++
    await rl.nextTick()

    withSession(async (session) => {
      await session.executeQuery(
        query,
        {
          $object_id_key: TypedValues.uint32(id),
          $object_id: TypedValues.uint32(id),
        },
        { commitTx: true, beginTx: { onlineReadOnly: {} } },
        settings
      )
    })
    // add to metrics real rps each 100s call
    if (counter % 100 === 0) {
      executor.realRPS.set({ jobName: 'read' }, rl.getRealRPS('read'))
    }
  }
  const endTime = new Date()
  const diffTime = (endTime.valueOf() - startTime.valueOf()) / 1000
  console.log({ counter, diffTime, rps: counter / diffTime })
}
