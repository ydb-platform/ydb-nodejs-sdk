import {RetryParameters} from "./RetryParameters";
import {RetryStrategy} from "./RetryStrategy";

export async function withRetries<T>(
    originalFunction: () => Promise<T>,
    strategyParams?: RetryParameters,
) {
    const wrappedMethodName = originalFunction.name;
    if (!strategyParams) {
        strategyParams = new RetryParameters();
    }
    const strategy = new RetryStrategy(wrappedMethodName, strategyParams);
    return await strategy.retry(originalFunction);
}
