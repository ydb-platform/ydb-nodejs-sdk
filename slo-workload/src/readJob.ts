/* eslint local-rules/context: "error" */

import { READ_RPS } from './utils/defaults';
import RateLimiter from './utils/RateLimiter';
import { DataGenerator } from './utils/DataGenerator';
import Executor from './utils/Executor';
import { ContextWithLogger } from './context-with-logger';

export const readJob = async (executor: Executor, readRPS?: number) => {
    const ctx = ContextWithLogger.get('ydb-nodejs-sdk:readJob');

    if (!readRPS) readRPS = READ_RPS;

    const rateLimiter = new RateLimiter('read', readRPS);
    let counter = 0;
    const withSession = ctx.doSync(() => executor.withSession('read'));

    while (Date.now() < executor.stopTime) {
        const id = ctx.doSync(() => DataGenerator.getRandomId());

        counter++;
        await ctx.do(() => rateLimiter.nextTick());

        ctx.doSync(() => withSession(async (session) => {
            await session.executeQuery(
                executor.qb.readQuery,
                { $id: id },
                { commitTx: true, beginTx: { onlineReadOnly: {} } },
                executor.qb.readExecuteQuerySettings,
            );
        }));
        // add to metrics real rps each 100s call
        if (counter % 500 === 0) {
            console.log('read x500', id.value?.uint64Value);
            ctx.doSync(() => executor.realRPS.set({ jobName: 'read' }, rateLimiter.getRealRPS('read')));
        }
    }
};
