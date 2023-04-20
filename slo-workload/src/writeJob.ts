import { WRITE_RPS, WRITE_TIMEOUT } from './utils/defaults'
import RateLimiter from './utils/RateLimiter'
import { DataGenerator } from './utils/DataGenerator'
import Executor from './utils/Executor'

export async function writeJob(executor: Executor, rps?: number) {
  if (!rps) rps = WRITE_RPS

  const rateLimiter = new RateLimiter('write', rps)
  await write(executor, rateLimiter)
}

async function write(executor: Executor, rl: RateLimiter) {
  let counter = 0
  const withSession = executor.withSession('write')
  while (new Date().valueOf() < executor.stopTime) {
    counter++
    await rl.nextTick()

    withSession(async (session) => {
      await session.executeQuery(
        executor.writeQuery,
        { ...DataGenerator.getUpsertData() },
        { commitTx: true, beginTx: { serializableReadWrite: {} } },
        executor.writeExecuteQuerySettings
      )
    })

    // add to metrics real rps each 100s call
    if (counter % 100 === 0) {
      executor.realRPS.set({ jobName: 'write' }, rl.getRealRPS('write'))
    }
  }
}
