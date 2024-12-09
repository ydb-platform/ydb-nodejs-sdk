import { WRITE_RPS } from './utils/defaults'
import RateLimiter from './utils/RateLimiter'
import { DataGenerator } from './utils/DataGenerator'
import Executor from './utils/Executor'

export async function writeJob(executor: Executor, rps?: number) {
  if (!rps) rps = WRITE_RPS

  const rateLimiter = new RateLimiter('write', rps)

  const withSession = executor.withSession('write')
  while (new Date().valueOf() < executor.stopTime) {
    await rateLimiter.nextTick()

    withSession(async (session) => {
      await session.executeQuery(
        executor.qb.writeQuery,
        { ...DataGenerator.getUpsertData() },
        { commitTx: true, beginTx: { serializableReadWrite: {} } },
        executor.qb.writeExecuteQuerySettings
      )
    })
  }
}
