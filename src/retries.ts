import {YdbError} from "./errors";


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
    static create(params: RetryParameters): RetryStrategy {
        switch (params.strategy) {
            case StrategyType.IMMEDIATE:
                return new ImmediateRetryStrategy();
            case StrategyType.CONSTANT:
                return new ConstantRetryStrategy(params.maxRetries, params.retryInterval);
            case StrategyType.LINEAR:
                return new LinearRetryStrategy(params.maxRetries, params.retryInterval, params.retryIntervalDelta);
            case StrategyType.EXPONENTIAL:
                return new ExponentialRetryStrategy(params.maxRetries, params.retryInterval);
            case StrategyType.RANDOM:
                return new RandomRetryStrategy(params.maxRetries, params.retryInterval);
            default:
                throw new Error(`Not implemented strategy: ${params.strategy}`);
        }
    }

    protected async shouldRetry(_result: any|YdbError): Promise<boolean> {
        return false;
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

    protected shouldRetry(result: any|YdbError): Promise<boolean> {
        return Promise.resolve(isResultRetryable(result) && this.maxRetries-- > 0);
    }
}

class ConstantRetryStrategy extends RetryStrategy {
    constructor(private maxRetries: number = 3, private retryInterval: number = 2000) {
        super();
    }

    protected shouldRetry(result: any|YdbError): Promise<boolean> {
        return new Promise((resolve) => {
            if (isResultRetryable(result) && this.maxRetries-- > 0) {
                console.log(`result is retriable, ${this.maxRetries} left`);
                setTimeout(() => resolve(true), this.retryInterval);
            } else {
                resolve(false);
            }
        });
    }
}

class LinearRetryStrategy extends RetryStrategy {
    constructor(private maxRetries: number = 3, private retryInterval: number = 2000, private retryIntervalDelta: number = 3000) {
        super();
    }

    protected shouldRetry(result: any|YdbError): Promise<boolean> {
        return new Promise((resolve) => {
            if (isResultRetryable(result) && this.maxRetries-- > 0) {
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
    constructor(private maxRetries: number = 5, private retryInterval: number = 2000) {
        super();
    }

    protected shouldRetry(result: any|YdbError): Promise<boolean> {
        return new Promise((resolve) => {
            if (isResultRetryable(result) && this.maxRetries-- > 0) {
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
    constructor(private maxRetries: number = 5, private retryInterval: number = 5000) {
        super();
    }

    protected shouldRetry(result: any|YdbError): Promise<boolean> {
        return new Promise((resolve) => {
            if (isResultRetryable(result) && this.maxRetries-- > 0) {
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
    return (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args: any) {
            return await RetryStrategy.retry(
                strategyParams,
                async () => await originalMethod.call(this, ...args)
            );
        };
    };
}
