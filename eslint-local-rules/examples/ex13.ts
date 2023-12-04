import { ContextWithLogger } from '../../src/context-with-logger';
// /* eslint-disable */
/* eslint local-rules/context: "error" */

const Retriable = () => {
    ContextWithLogger.get('ydb-sdk:...eslint-local-rules.examples.Retriable');
};

@Retriable
export class C {
    @Retriable
    public async M() {
        ContextWithLogger.getSafe('ydb-sdk:...eslint-local-rules.examples.C.M', this);

        ctx.logger.info('test');

        // /** */

        //
        // console.info(1000);

        // console.info(1000);
        // setTimeout(ctx.doHandleError(() => F()), 10);
    }
}
