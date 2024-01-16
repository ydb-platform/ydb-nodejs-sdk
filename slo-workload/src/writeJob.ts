import { WRITE_RPS } from './utils/defaults'
import RateLimiter from './utils/RateLimiter'
import { DataGenerator } from './utils/DataGenerator'
import Executor from './utils/Executor'

export async function writeJob(executor: Executor, rps?: number) {
    if (!rps) rps = WRITE_RPS

    const rateLimiter = new RateLimiter('write', rps)

    let counter = 0
    const withSession = executor.withSession('write')
    while (new Date().valueOf() < executor.stopTime) {
        counter++
        await rateLimiter.nextTick()

        withSession(async (session) => {
            await session.executeQuery(
                executor.qb.writeQuery,
                { ...DataGenerator.getUpsertData() },
                { commitTx: true, beginTx: { serializableReadWrite: {} } },
                executor.qb.writeExecuteQuerySettings
            )
        })

        // add to metrics real rps each 100s call
        if (counter % 500 === 0) {
            console.log('write x500', DataGenerator.getMaxId())
            executor.realRPS.set({ jobName: 'write' }, rateLimiter.getRealRPS('write'))
        }
    }
}
