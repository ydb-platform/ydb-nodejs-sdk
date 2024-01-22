/* eslint local-rules/context: "error" */
import * as grpc from '@grpc/grpc-js';
import { ContextWithLogger } from '../../src/context-with-logger';
import { Endpoint } from '../../src/discovery';
import { Logger } from '../../src';

// const t = async () => {
//     // session = /* ctx-off */ await ctx.do(() => this.createSession());
//     const ctx = ContextWithLogger.get('ydb-nodejs-sdk:...eslint-local-rules.examples.t');
//
//     ctx.logger.info('test');
//     // ctx.doSync(() => q(await ctx.do(() => f())));
// };

export class SessionService extends AuthenticatedService<TableService> {
    async f() {
        ContextWithLogger.get('ydb-nodejs-sdk:...eslint-local-rules.examples.SessionService.f', this);
        const response = /* ctx-off */ await this.api.explainDataQuery(request);
    }
}
