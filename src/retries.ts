// eslint-disable-next-line max-classes-per-file
import { YdbError, TransportError } from './errors';
import { getLogger, Logger } from './logging';
import * as errors from './errors';
import { sleep } from './utils';

export class BackoffSettings {
    /**
     * Create backoff settings - uses randomized exponential timeouts with a base of 2
     * Timeout formula: `2^min(retries, backoffCeiling) * backoffSlotDuration * (1 - random() * uncertainRatio)`
     * @param backoffCeiling - max power — (n) in `2^n`
     * @param backoffSlotDuration - multiplier for exponent
     * @param uncertainRatio - timeout fraction that is randomized
     */
    constructor(
        public backoffCeiling: number,
        public backoffSlotDuration: number,
        private uncertainRatio = 0.5,
    ) {}

    async waitBackoffTimeout(retries: number) {
        // eslint-disable-next-line no-bitwise
        const slotsCount = 1 << Math.min(retries, this.backoffCeiling);
        const maxDuration = slotsCount * this.backoffSlotDuration;
        const duration = maxDuration * (1 - Math.random() * this.uncertainRatio);

        return sleep(duration);
    }
}

export class RetryParameters {
    public retryNotFound: boolean;
    public unknownErrorHandler: (_error: unknown) => void;
    public maxRetries: number;
    public onYdbErrorCb: (_error: YdbError) => void;
    public fastBackoff: BackoffSettings;
    public slowBackoff: BackoffSettings;

    constructor({
        maxRetries = 10,
        onYdbErrorCb = (_error: YdbError) => {},
        backoffCeiling = 6,
        backoffSlotDuration = 1000,
    } = {}) {
        this.maxRetries = maxRetries;
        this.onYdbErrorCb = onYdbErrorCb;
        this.fastBackoff = new BackoffSettings(10, 5);
        this.slowBackoff = new BackoffSettings(backoffCeiling, backoffSlotDuration);

        this.retryNotFound = true;
        this.unknownErrorHandler = () => {};
    }
}

const RETRYABLE_ERRORS_FAST = [
    errors.Unavailable,
    errors.Aborted,
    errors.NotFound,
    errors.TransportUnavailable,
    errors.ClientDeadlineExceeded,
];
const RETRYABLE_ERRORS_SLOW = [errors.Overloaded, errors.ClientResourceExhausted];

class RetryStrategy {
    private logger: Logger;
    constructor(
        // eslint-disable-next-line @typescript-eslint/default-param-last
        public methodName = 'UnknownClass::UnknownMethod',
        public retryParameters: RetryParameters,
        logger?: Logger,
    ) {
        this.logger = logger || getLogger();
    }

    async retry<T>(asyncMethod: () => Promise<T>) {
        let retries = 0;
        let error: unknown;
        const { retryParameters } = this;

        while (retries < retryParameters.maxRetries) {
            try {
                // eslint-disable-next-line no-await-in-loop
                return await asyncMethod();
            } catch (error_) {
                // eslint-disable-next-line no-ex-assign
                if (TransportError.isMember(error_)) error_ = TransportError.convertToYdbError(error_);
                error = error_;
                if (error_ instanceof YdbError) {
                    const errName = error_.constructor.name;
                    const retriesLeft = retryParameters.maxRetries - retries;

                    // eslint-disable-next-line @typescript-eslint/no-loop-func
                    if (RETRYABLE_ERRORS_FAST.some((cls) => error_ instanceof cls)) {
                        retryParameters.onYdbErrorCb(error_);
                        if (error_ instanceof errors.NotFound && !retryParameters.retryNotFound) {
                            throw error_;
                        }

                        // eslint-disable-next-line unicorn/consistent-destructuring
                        this.logger.warn(
                            `Caught an error ${errName}, retrying with fast backoff, ${retriesLeft} retries left`,
                        );
                        // eslint-disable-next-line unicorn/consistent-destructuring,no-await-in-loop
                        await this.retryParameters.fastBackoff.waitBackoffTimeout(retries);
                        // eslint-disable-next-line @typescript-eslint/no-loop-func
                    } else if (RETRYABLE_ERRORS_SLOW.some((cls) => error_ instanceof cls)) {
                        retryParameters.onYdbErrorCb(error_);

                        // eslint-disable-next-line unicorn/consistent-destructuring
                        this.logger.warn(
                            `Caught an error ${errName}, retrying with slow backoff, ${retriesLeft} retries left`,
                        );
                        // eslint-disable-next-line no-await-in-loop,unicorn/consistent-destructuring
                        await this.retryParameters.slowBackoff.waitBackoffTimeout(retries);
                    } else {
                        retryParameters.onYdbErrorCb(error_);
                        throw error_;
                    }
                } else {
                    retryParameters.unknownErrorHandler(error_);
                    throw error_;
                }
            }
            retries++;
        }
        // eslint-disable-next-line unicorn/consistent-destructuring
        this.logger.warn('All retries have been used, re-throwing error');
        throw error;
    }
}

export function retryable(strategyParams?: RetryParameters, retryStrategyLogger?: Logger) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;
        const wrappedMethodName = `${target.constructor.name}::${propertyKey}`;

        // eslint-disable-next-line no-param-reassign
        if (!strategyParams) strategyParams = new RetryParameters();
        const strategy = new RetryStrategy(wrappedMethodName, strategyParams, retryStrategyLogger);

        // eslint-disable-next-line no-param-reassign
        descriptor.value = async function (...args: any) {
            return strategy.retry(() => originalMethod.call(this, ...args));
        };
    };
}

export const withRetries = async <T>(originalFunction: () => Promise<T>, strategyParams?: RetryParameters) => {
    const wrappedMethodName = originalFunction.name;

    if (!strategyParams) {
        // eslint-disable-next-line no-param-reassign
        strategyParams = new RetryParameters();
    }
    const strategy = new RetryStrategy(wrappedMethodName, strategyParams);

    return strategy.retry(originalFunction);
};
