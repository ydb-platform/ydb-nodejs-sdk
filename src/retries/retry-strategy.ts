import { Logger } from '../utils/simple-logger';
import { TransportError, YdbError } from '../errors';
import * as errors from '../errors';
import { RetryParameters } from './retry-parameters';
import { getContext } from '../utils/context';
import { Trace } from './consts';

const RETRYABLE_ERRORS_FAST = [
    errors.Unavailable,
    errors.Aborted,
    errors.NotFound,
    errors.TransportUnavailable,
    errors.ClientDeadlineExceeded,
];
const RETRYABLE_ERRORS_SLOW = [errors.Overloaded, errors.ClientResourceExhausted];

/**
 * Implementing a strategy to repeat operations, in case of errors.  Basic rules:
 * - repetitions are done with increasing intervals between repetitions. there is a parameter that limits the maximum interval;
 * - there is a limit on the number of repetitions;
 * - and there is a random factor in selecting the interval with a scatter limit.
 *
 * The strategy parameters are passed in the RetryParameters structure.
 */
export class RetryStrategy {
    constructor(
        public methodName = 'UnknownClass::UnknownMethod',
        public retryParameters: RetryParameters,
        private logger: Logger,
    ) {}

    async retry<T>(asyncMethod: () => Promise<T>) {
        const ctx = getContext();

        this.logger.trace(Trace.retriable, ctx);

        let retries = 0;
        let error: unknown;
        const { retryParameters } = this;

        while (retries < retryParameters.maxRetries) {
            try {
                return await asyncMethod();
            } catch (error_) {
                if (TransportError.isMember(error_)) error_ = TransportError.convertToYdbError(error_);
                error = error_;
                if (error_ instanceof YdbError) {
                    const errName = error_.constructor.name;
                    const retriesLeft = retryParameters.maxRetries - retries;

                    if (RETRYABLE_ERRORS_FAST.some((cls) => error_ instanceof cls)) {
                        retryParameters.onYdbErrorCb(error_);
                        if (error_ instanceof errors.NotFound && !retryParameters.retryNotFound) {
                            throw error_;
                        }

                        this.logger.warn(
                            `Caught an error ${errName}, retrying with fast backoff, ${retriesLeft} retries left`,
                        );
                        await this.retryParameters.fastBackoff.waitBackoffTimeout(retries);
                    } else if (RETRYABLE_ERRORS_SLOW.some((cls) => error_ instanceof cls)) {
                        retryParameters.onYdbErrorCb(error_);

                        this.logger.warn(
                            `Caught an error ${errName}, retrying with slow backoff, ${retriesLeft} retries left`,
                        );
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
        this.logger.warn('All retries have been used, re-throwing error');
        throw error;
    }
}
