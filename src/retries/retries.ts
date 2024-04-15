import {Logger} from '../logger/simple-logger';
import {getDefaultLogger} from "../logger/get-default-logger";
import {HasLogger} from "../logger/has-logger";
import {RetryParameters} from "./retryParameters";
import {RetryableResult, RetryStrategy} from "./retryStrategy";

export function retryable(): RetryableResult;
export function retryable(strategyParams: RetryParameters): RetryableResult;
/**
 * @deprecated retryStrategyLogger not in use anymore
 */
export function retryable(strategyParams: RetryParameters, retryStrategyLogger: Logger): RetryableResult;

// add work context and @EnsureContext
export function retryable(strategyParams?: RetryParameters) {
    return (target: HasLogger, propertyKey: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;
        const wrappedMethodName = `${target.constructor.name}::${propertyKey}`;
        let strategy: RetryStrategy;
        descriptor.value = async function (...args: any) {
            if (!strategy) { // first time
                if (!strategyParams) strategyParams = new RetryParameters();
                strategy = new RetryStrategy(wrappedMethodName, strategyParams, (this as HasLogger).logger);
            }
            return await strategy.retry(async () => await originalMethod.call(this, ...args));
        };
    };
}

// TODO: Become to complicated.  Use Strategy directly
export async function withRetries<T>(
    originalFunction: () => Promise<T>,
    strategyParamsOrLogger?: RetryParameters | Logger,
): Promise<T>;
export async function withRetries<T>(
    originalFunction: () => Promise<T>,
    strategyParamsOrLogger: RetryParameters,
    logger?: Logger,
): Promise<T>;
export async function withRetries<T>(
    originalFunction: () => Promise<T>,
    strategyParamsOrLogger?: RetryParameters | Logger,
    logger?: Logger,
) {
    const hasLogger = typeof strategyParamsOrLogger === 'object' && strategyParamsOrLogger !== null && 'error' in strategyParamsOrLogger;
    const params = (strategyParamsOrLogger && !hasLogger) ? (strategyParamsOrLogger as RetryParameters) : new RetryParameters();

    const wrappedMethodName = originalFunction.name;
    const strategy = new RetryStrategy(wrappedMethodName, params, hasLogger ? (strategyParamsOrLogger as Logger) : (logger ?? getDefaultLogger()));
    return await strategy.retry(originalFunction);
}
