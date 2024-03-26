import {YdbError, TransportError} from './errors';
import {getLogger, Logger} from './logging';
import * as errors from './errors';
import * as utils from "./utils";

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
        const slotsCount = 1 << Math.min(retries, this.backoffCeiling);
        const maxDuration = slotsCount * this.backoffSlotDuration;
        const duration = maxDuration * (1 - Math.random() * this.uncertainRatio);
        return utils.sleep(duration);
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
        public methodName = 'UnknownClass::UnknownMethod',
        public retryParameters: RetryParameters,
        logger?: Logger,
    ) {
        this.logger = logger ?? getLogger();
    }

    async retry<T>(asyncMethod: () => Promise<T>) {
        let retries = 0;
        let error: unknown;
        const retryParameters = this.retryParameters;
        while (retries < retryParameters.maxRetries) {
            try {
                return await asyncMethod();
            } catch (e) {
                if(TransportError.isMember(e)) e = TransportError.convertToYdbError(e)
                error = e;
                if (e instanceof YdbError) {
                    const errName = e.constructor.name;
                    const retriesLeft = retryParameters.maxRetries - retries;
                    if (RETRYABLE_ERRORS_FAST.some((cls) => e instanceof cls)) {
                        retryParameters.onYdbErrorCb(e);
                        if (e instanceof errors.NotFound && !retryParameters.retryNotFound) {
                            throw e;
                        }

                        this.logger.warn(
                            `Caught an error ${errName}, retrying with fast backoff, ${retriesLeft} retries left`,
                        );
                        await this.retryParameters.fastBackoff.waitBackoffTimeout(retries);
                    } else if (RETRYABLE_ERRORS_SLOW.some((cls) => e instanceof cls)) {
                        retryParameters.onYdbErrorCb(e);

                        this.logger.warn(
                            `Caught an error ${errName}, retrying with slow backoff, ${retriesLeft} retries left`,
                        );
                        await this.retryParameters.slowBackoff.waitBackoffTimeout(retries);
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
        this.logger.warn('All retries have been used, re-throwing error');
        throw error;
    }
}

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
