import {Logger} from "../utils/simple-logger";
import {RetryParameters} from "./RetryParameters";
import {RetryStrategy} from "./RetryStrategy";
import {getLoggerFromObject} from "../utils/getLoggerFromObject";
import {getContext} from "../utils/context";

/**
 * TypeScript decorator, which apllies RetryStrategy to a method.
 */
export function retryable(strategyParams?: RetryParameters, /** @deprecated **/ loggerDeprecated?: Logger) {
    if (loggerDeprecated) {
        console.warn(new Error('Parameter "logger" was deprecated').stack); // as trace thru console
    }
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;
        const wrappedMethodName = `${target.constructor.name}::${propertyKey}`;

        if (!strategyParams) strategyParams = new RetryParameters();

        descriptor.value = async function (...args: any) {
            const ctx = getContext();
            const logger = getLoggerFromObject(this);
            let strategy = new RetryStrategy(wrappedMethodName, strategyParams!, logger);
            return await ctx.do(() => strategy.retry(async () => await originalMethod.call(this, ...args)));
        };
    };
}
