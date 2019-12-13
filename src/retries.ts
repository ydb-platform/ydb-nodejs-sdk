import {YdbError} from "./errors";
import getLogger from "./logging";


export enum StrategyType {
    IMMEDIATE,
    CONSTANT,
    LINEAR,
    EXPONENTIAL,
    RANDOM
}

function isResultRetryable(error: any|YdbError) {
    return error instanceof YdbError && error.isRetryable;
}

export interface RetryParameters {
    strategy: StrategyType,
    wrappedMethodName?: string,
    maxRetries?: number,
    retryInterval?: number,
    retryIntervalDelta?: number
}

async function muffleErrors(asyncMethod: () => Promise<any>) {
    try {
        return await asyncMethod();
    } catch (e) {
        return e;
    }
}

export abstract class RetryStrategy {
    protected constructor(
        protected methodName = 'UnknownClass::UnknownMethod',
        protected maxRetries = 0,
        protected retryInterval = 0
    ) {}

    static create(params: RetryParameters): RetryStrategy {
        switch (params.strategy) {
            case StrategyType.IMMEDIATE:
                return new ImmediateRetryStrategy(params.wrappedMethodName);
            case StrategyType.CONSTANT:
                return new ConstantRetryStrategy(params.wrappedMethodName, params.maxRetries, params.retryInterval);
            case StrategyType.LINEAR:
                return new LinearRetryStrategy(
                    params.wrappedMethodName, params.maxRetries, params.retryInterval, params.retryIntervalDelta
                );
            case StrategyType.EXPONENTIAL:
                return new ExponentialRetryStrategy(params.wrappedMethodName, params.maxRetries, params.retryInterval);
            case StrategyType.RANDOM:
                return new RandomRetryStrategy(params.wrappedMethodName, params.maxRetries, params.retryInterval);
            default:
                throw new Error(`Not implemented strategy: ${params.strategy}`);
        }
    }

    protected async shouldRetry(_result: any|YdbError): Promise<boolean> {
        return false;
    }

    protected logAndUpdateMaxRetries() {
        const logger = getLogger();
        logger.debug(`${this.methodName} call failed, ${this.maxRetries} attempts left, retrying in ${this.retryInterval} ms`);
        this.maxRetries--;
    }

    static async retry(strategyParams: RetryParameters, asyncMethod: () => Promise<any>) {
        let result: any|YdbError;
        const strategy = RetryStrategy.create(strategyParams);
        do {
            result = await muffleErrors(asyncMethod);
        } while (await strategy.shouldRetry(result));

        if (result instanceof Error) {
            throw result;
        } else {
            return result;
        }
    }
}

class ImmediateRetryStrategy extends RetryStrategy {
    maxRetries = 1;
    retryInterval = 0;

    protected shouldRetry(result: any|YdbError): Promise<boolean> {
        let retryable = false;
        if (isResultRetryable(result) && this.maxRetries > 0) {
            this.logAndUpdateMaxRetries();
            retryable = true;
        }
        return Promise.resolve(retryable);
    }
}

class ConstantRetryStrategy extends RetryStrategy {
    constructor(methodName?: string, maxRetries: number = 3, retryInterval: number = 2000) {
        super(methodName, maxRetries, retryInterval);
    }

    protected shouldRetry(result: any|YdbError): Promise<boolean> {
        return new Promise((resolve) => {
            if (isResultRetryable(result) && this.maxRetries > 0) {
                this.logAndUpdateMaxRetries();
                setTimeout(() => resolve(true), this.retryInterval);
            } else {
                resolve(false);
            }
        });
    }
}

class LinearRetryStrategy extends RetryStrategy {
    constructor(
        methodName?: string,
        maxRetries: number = 3,
        retryInterval: number = 2000,
        private retryIntervalDelta: number = 3000
    ) {
        super(methodName, maxRetries, retryInterval);
    }

    protected shouldRetry(result: any|YdbError): Promise<boolean> {
        return new Promise((resolve) => {
            if (isResultRetryable(result) && this.maxRetries > 0) {
                this.logAndUpdateMaxRetries();
                setTimeout(() => {
                    this.retryInterval += this.retryIntervalDelta;
                    resolve(true);
                }, this.retryInterval);
            } else {
                resolve(false);
            }
        });
    }
}

class ExponentialRetryStrategy extends RetryStrategy {
    private retriesAttempted = 0;
    constructor(methodName?: string, maxRetries: number = 5, retryInterval: number = 2000) {
        super(methodName, maxRetries, retryInterval);
    }

    protected shouldRetry(result: any|YdbError): Promise<boolean> {
        return new Promise((resolve) => {
            if (isResultRetryable(result) && this.maxRetries > 0) {
                this.logAndUpdateMaxRetries();
                setTimeout(() => {
                    this.retriesAttempted++;
                    resolve(true);
                }, this.retryInterval * Math.pow(2, this.retriesAttempted));
            } else {
                resolve(false);
            }
        });
    }
}

class RandomRetryStrategy extends RetryStrategy {
    constructor(methodName?: string, maxRetries: number = 5, retryInterval: number = 5000) {
        super(methodName, maxRetries, retryInterval);
    }

    protected shouldRetry(result: any|YdbError): Promise<boolean> {
        return new Promise((resolve) => {
            if (isResultRetryable(result) && this.maxRetries > 0) {
                this.logAndUpdateMaxRetries();
                setTimeout(() => {
                    resolve(true);
                }, this.retryInterval * Math.random());
            } else {
                resolve(false);
            }
        });
    }
}

export function retryable(strategyParams: RetryParameters) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;
        const wrappedMethodName = `${target.constructor.name}::${propertyKey}`;
        descriptor.value = async function (...args: any) {
            return await RetryStrategy.retry(
                {...strategyParams, wrappedMethodName},
                async () => await originalMethod.call(this, ...args)
            );
        };
    };
}
