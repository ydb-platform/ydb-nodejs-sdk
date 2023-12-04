/* eslint-disable unicorn/prefer-module,  global-require */

import { ContextWithLogger } from '../../src/context-with-logger';
import { Logger } from '../../src/utils/simple-logger';

class B {}

export class A {
    // @ts-ignore
    constructor(private logger: Logger) {
        const ctx = ContextWithLogger.getSafe(logger, 'A.constructor');
        const b = ctx.doSync(() => new B());
    }

    async n() {
        const ctx = ContextWithLogger.getSafe(this, 'A.constructor');

        await ctx.do(() => { console.info('123'); });

        setTimeout(async () => {
            await ctx.do(() => {
                console.info('321');
            });
        }, 0);
    }
}
