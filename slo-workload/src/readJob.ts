import { READ_RPS } from './utils/defaults'
import RateLimiter from './utils/RateLimiter'
import { DataGenerator } from './utils/DataGenerator'
import Executor from './utils/Executor'

export async function readJob(executor: Executor, readRPS?: number) {
  if (!readRPS) readRPS = READ_RPS

  const rateLimiter = new RateLimiter('read', readRPS)
  let counter = 0
  const withSession = executor.withSession('read')
  while (new Date().valueOf() < executor.stopTime) {
    const id = DataGenerator.getRandomId()
    counter++
    await rateLimiter.nextTick()

    withSession(async (session) => {
      await session.executeQuery(
        executor.qb.readQuery,
        { $id: id },
        { commitTx: true, beginTx: { onlineReadOnly: {} } },
        executor.qb.readExecuteQuerySettings
      )
    })
    // add to metrics real rps each 100s call
    if (counter % 500 === 0) {
      console.log('read x500', id.value?.uint64Value)
      executor.realRPS.set({ jobName: 'read' }, rateLimiter.getRealRPS('read'))
    }
  }
}
