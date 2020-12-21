import {YdbError} from "./errors";
import getLogger, {Logger} from './logging';
import * as errors from './errors';
import {sleep} from './utils';

export class RetryParameters {
    public retryNotFound: boolean;
    public retryInternalError: boolean;
    public unknownErrorHandler: (_error: unknown) => void;
    public maxRetries: number;
    public onYdbErrorCb: (_error: YdbError) => void;
    public backoffCeiling: number;
    public backoffSlotDuration: number;

    constructor(
        {
            maxRetries = 10,
            onYdbErrorCb = (_error: YdbError) => {},
            backoffCeiling = 6,
            backoffSlotDuration = 1,
        } = {}
    ) {
        this.maxRetries = maxRetries;
        this.onYdbErrorCb = onYdbErrorCb;
        this.backoffCeiling = backoffCeiling;
        this.backoffSlotDuration = backoffSlotDuration;

        this.retryNotFound = true;
        this.retryInternalError = true;
        this.unknownErrorHandler = () => {};
    }
}

const RETRYABLE_ERRORS = [
    errors.Unavailable, errors.Aborted, errors.NotFound, errors.InternalError
];
const RETRYABLE_W_DELAY_ERRORS = [errors.Overloaded, errors.ConnectionError, errors.SessionBusy];

class RetryStrategy {
    private logger: Logger;
    constructor(
        public methodName = 'UnknownClass::UnknownMethod',
        public retryParameters: RetryParameters
    ) {
        this.logger = getLogger();
    }

    static async waitBackoffTimeout(retryParameters: RetryParameters, retries: number) {
        const slotsCount = 1 << Math.min(retries, retryParameters.backoffCeiling);
        const maxDuration = slotsCount * retryParameters.backoffSlotDuration;
        return sleep(Math.random() * maxDuration);
    }

    async retry<T>(asyncMethod: () => Promise<T>) {
        let retries = 0;
        let error: unknown;
        const retryParameters = this.retryParameters;
        while (retries < retryParameters.maxRetries) {
            try {
                return await asyncMethod();
            } catch (e) {
                error = e;
                if (e instanceof YdbError) {
                    const errName = e.constructor.name;
                    const retriesLeft = retryParameters.maxRetries - retries;
                    if (RETRYABLE_ERRORS.some((cls) => e instanceof cls)) {
                        retryParameters.onYdbErrorCb(e);

                        if (e instanceof errors.NotFound && !retryParameters.retryNotFound) {
                            throw e;
                        }

                        if (e instanceof errors.InternalError && !retryParameters.retryInternalError) {
                            throw e;
                        }
                        this.logger.warn(`Caught an error ${errName}, retrying immediately, ${retriesLeft} retries left`);
                    } else if (RETRYABLE_W_DELAY_ERRORS.some((cls) => e instanceof cls)) {
                        this.logger.warn(`Caught an error ${errName}, retrying with a backoff, ${retriesLeft} retries left`);
                        retryParameters.onYdbErrorCb(e);

                        await RetryStrategy.waitBackoffTimeout(retryParameters, retries);
                    } else {
                        retryParameters.onYdbErrorCb(e);
                        throw e;
                    }
                } else {
                    retryParameters.unknownErrorHandler(e);
                    throw e;
                }
            }
            retries++;
        }
        this.logger.debug('All retries have been used, re-throwing error');
        throw error;
    }
}

export function retryable(strategyParams?: RetryParameters) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;
        const wrappedMethodName = `${target.constructor.name}::${propertyKey}`;
        if (!strategyParams) {
            strategyParams = new RetryParameters();
        }
        const strategy = new RetryStrategy(wrappedMethodName, strategyParams);
        descriptor.value = async function (...args: any) {
            return await strategy.retry(
                async () => await originalMethod.call(this, ...args)
            );
        };
    };
}

export async function withRetries<T>(originalFunction: () => Promise<T>, strategyParams?: RetryParameters) {
    const wrappedMethodName = originalFunction.name;
    if (!strategyParams) {
        strategyParams = new RetryParameters();
    }
    const strategy = new RetryStrategy(wrappedMethodName, strategyParams);
    return await strategy.retry(originalFunction);
}
