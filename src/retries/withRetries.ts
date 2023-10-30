import { RetryParameters } from './retry-parameters';
import { RetryStrategy } from './retry-strategy';
import { ContextWithLogger } from '../context-with-logger';
import { Trace } from './consts';

/**
 * TypeScript function wrapper, which apllies RetryStrategy to a function.
 *
 * @deprecated Thuis method are not used in the sdk.
 */
export const withRetries = async <T>(originalFunction: () => Promise<T>, strategyParams?: RetryParameters) => {
    const ctx = ContextWithLogger.get(Trace.withRetries);

    const wrappedMethodName = originalFunction.name;

    if (!strategyParams) {
        strategyParams = new RetryParameters();
    }
    const strategy = ctx.doSync(() => new RetryStrategy(wrappedMethodName, strategyParams!, ctx.logger));

    return ctx.do(() => strategy.retry(originalFunction));
};
