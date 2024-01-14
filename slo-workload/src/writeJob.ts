/* eslint local-rules/context: "error" */

import { WRITE_RPS } from './utils/defaults';
import RateLimiter from './utils/RateLimiter';
import { DataGenerator } from './utils/DataGenerator';
import Executor from './utils/Executor';
import { ContextWithLogger } from './context-with-logger';

export const writeJob = async (executor: Executor, rps?: number) => {
    const ctx = ContextWithLogger.get('ydb-nodejs-sdk:writeJob');

    if (!rps) rps = WRITE_RPS;

    const rateLimiter = new RateLimiter('write', rps);

    let counter = 0;
    const withSession = ctx.doSync(() => executor.withSession('write'));

    while (Date.now() < executor.stopTime) {
        counter++;
        await ctx.do(() => rateLimiter.nextTick());

        ctx.doSync(() => withSession(async (session) => {
            await session.executeQuery(
                executor.qb.writeQuery,
                { ...DataGenerator.getUpsertData() },
                { commitTx: true, beginTx: { serializableReadWrite: {} } },
                executor.qb.writeExecuteQuerySettings,
            );
        }));

        // add to metrics real rps each 100s call
        if (counter % 500 === 0) {
            console.log('write x500', ctx.doSync(() => DataGenerator.getMaxId()));
            ctx.doSync(() => executor.realRPS.set({ jobName: 'write' }, rateLimiter.getRealRPS('write')));
        }
    }
};
