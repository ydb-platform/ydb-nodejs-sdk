import {Logger} from '../logger/simple-logger';
import {HasLogger} from "../logger/has-logger";
import {RetryParameters} from "./retryParameters";
import {RetryableResult, RetryStrategy} from "./retryStrategy";
import {TransportError, YdbError} from "./errors";
import {Context} from "../context/Context";

// @ts-ignore
export function retryable(strategyParams?: RetryParameters): RetryableResult;
export function retryable(ctx: Context, strategyParams?: RetryParameters): RetryableResult;
/**
 * @deprecated retryStrategyLogger not in use anymore
 */
export function retryable(strategyParams: RetryParameters, retryStrategyLogger: Logger): RetryableResult;

// add work context and @EnsureContext
export function retryable(ctx: Context, strategyParams?: RetryParameters) {
    return (_target: HasLogger, _propertyKey: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;
        // const wrappedMethodName = `${target.constructor.name}::${propertyKey}`;
        let strategy: RetryStrategy;
        descriptor.value = async function (this: HasLogger,...args: any) {
            if (!strategy) { // first time
                if (!strategyParams) strategyParams = new RetryParameters();
                strategy = new RetryStrategy(/*wrappedMethodName,*/ strategyParams, this.logger);
            }
            return await strategy.retry(ctx, async (_ctx: Context, _retryCount: number) => {
                let result: unknown, err: YdbError | undefined;
                try {
                    result = await originalMethod.call(this, ...args);
                } catch (error) {
                    if (TransportError.isMember(error)) error = TransportError.convertToYdbError(error);
                    if (error instanceof YdbError) err = error;
                    else throw error;
                }
                return {
                    result,
                    err,
                    idempotent: true
                };
            });
        };
    };
}

// TODO: Become to complicated.  Use Strategy directly
// export async function withRetries<T>(
//     originalFunction: () => Promise<T>,
//     strategyParamsOrLogger?: RetryParameters | Logger,
// ): Promise<T>;
// export async function withRetries<T>(
//     originalFunction: () => Promise<T>,
//     strategyParamsOrLogger: RetryParameters,
//     logger?: Logger,
// ): Promise<T>;
// export async function withRetries<T>(
//     originalFunction: () => Promise<T>,
//     strategyParamsOrLogger?: RetryParameters | Logger,
//     logger?: Logger,
// ) {
//     const hasLogger = typeof strategyParamsOrLogger === 'object' && strategyParamsOrLogger !== null && 'error' in strategyParamsOrLogger;
//     const params = (strategyParamsOrLogger && !hasLogger) ? (strategyParamsOrLogger as RetryParameters) : new RetryParameters();
//
//     const wrappedMethodName = originalFunction.name;
//     const strategy = new RetryStrategy(wrappedMethodName, params, hasLogger ? (strategyParamsOrLogger as Logger) : (logger ?? getDefaultLogger()));
//     return await strategy.retry(originalFunction);
// }
