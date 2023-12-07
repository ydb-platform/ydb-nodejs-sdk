/* eslint-disable */
/* eslint local-rules/context: "warn" */

import { Logger } from '../../src/utils/simple-logger';

class B {}

export class A {
    // @ts-ignore
    constructor(private logger: Logger) {
        const b = new B();
    }

    async n() {
        // eslint-disable-next-line no-console
        console.info('123');

        // setTimeout(async () => {
        //     await ctx.doHandleError(() => {
        //         // eslint-disable-next-line no-console
        //         console.info('321');
        //     });
        // }, 0);
    }

    t = async () => {
    }
}
