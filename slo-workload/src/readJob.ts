import { READ_RPS, READ_TIMEOUT } from './utils/defaults'
import RateLimiter from './utils/RateLimiter'
import { DataGenerator } from './utils/DataGenerator'
import Executor from './utils/Executor'

export async function readJob(executor: Executor, readRPS?: number) {
  if (!readRPS) readRPS = READ_RPS

  const rateLimiter = new RateLimiter('read', readRPS)
  await read(executor, rateLimiter)
}

async function read(executor: Executor, rl: RateLimiter) {
  let counter = 0
  const withSession = executor.withSession('read')
  while (new Date().valueOf() < executor.stopTime) {
    const id = DataGenerator.getRandomId()
    counter++
    await rl.nextTick()

    withSession(async (session) => {
      await session.executeQuery(
        executor.readQuery,
        { $id: id },
        { commitTx: true, beginTx: { onlineReadOnly: {} } },
        executor.readExecuteQuerySettings
      )
    })
    // add to metrics real rps each 100s call
    if (counter % 100 === 0) {
      executor.realRPS.set({ jobName: 'read' }, rl.getRealRPS('read'))
    }
  }
}
