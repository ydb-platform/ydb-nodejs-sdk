import {Logger} from "../logging";
import {RetryParameters} from "./RetryParameters";
import {RetryStrategy} from "./RetryStrategy";

export function retryable(strategyParams?: RetryParameters, retryStrategyLogger?: Logger) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;
        const wrappedMethodName = `${target.constructor.name}::${propertyKey}`;

        if (!strategyParams) strategyParams = new RetryParameters();
        let strategy = new RetryStrategy(wrappedMethodName, strategyParams, retryStrategyLogger);

        descriptor.value = async function (...args: any) {
            return await strategy.retry(async () => await originalMethod.call(this, ...args));
        };
    };
}
