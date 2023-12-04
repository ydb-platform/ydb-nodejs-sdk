/* eslint-disable */
/* eslint local-rules/context: "warn" */

import { ContextWithLogger } from '../../src/context-with-logger';
import { Logger } from '../../src/utils/simple-logger';

class B {}

export class A {
    // @ts-ignore
    constructor(private logger: Logger) {
        const ctx = ContextWithLogger.getSafe(this, 'A.constructor');
        // @ts-ignore
        const b = ctx.doSync(() => new B());
    }

    async n() {
        const ctx = ContextWithLogger.getSafe(this, 'A.constructor');

        // eslint-disable-next-line no-console
        await ctx.do(() => { console.info('123'); });

        setTimeout(async () => {
            await ctx.doHandleError(() => {
                // eslint-disable-next-line no-console
                console.info('321');
            });
        }, 0);
    }
}
