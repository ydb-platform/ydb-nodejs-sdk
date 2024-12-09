import { READ_RPS } from './utils/defaults'
import RateLimiter from './utils/RateLimiter'
import { DataGenerator } from './utils/DataGenerator'
import Executor from './utils/Executor'

export async function readJob(executor: Executor, readRPS?: number) {
  if (!readRPS) readRPS = READ_RPS

  const rateLimiter = new RateLimiter('read', readRPS)
  const withSession = executor.withSession('read')

  while (new Date().valueOf() < executor.stopTime) {
    const id = DataGenerator.getRandomId()
    await rateLimiter.nextTick()

    withSession(async (session) => {
      await session.executeQuery(
        executor.qb.readQuery,
        { $id: id },
        { commitTx: true, beginTx: { onlineReadOnly: {} } },
        executor.qb.readExecuteQuerySettings
      )
    })
  }
}
