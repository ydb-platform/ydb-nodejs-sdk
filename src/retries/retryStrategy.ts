import * as errors from "./errors";
import {TransportError, YdbError} from "./errors";
import {HasLogger} from "../logger/has-logger";
import {Logger} from "../logger/simple-logger";
import {RetryParameters} from "./retryParameters";
import {getDefaultLogger} from "../logger/get-default-logger";
import {Context} from "../context/Context";
import {EnsureContext} from "../context/EnsureContext";

const RETRYABLE_ERRORS_FAST = [
    errors.Unavailable,
    errors.Aborted,
    errors.NotFound,
    errors.TransportUnavailable,
    errors.ClientDeadlineExceeded,
];
const RETRYABLE_ERRORS_SLOW = [errors.Overloaded, errors.ClientResourceExhausted];

export class RetryStrategy implements HasLogger {
    constructor(
        public methodName = 'UnknownClass::UnknownMethod',
        public retryParameters: RetryParameters,
        public readonly logger: Logger,
    ) {
    }

    @EnsureContext(true)
    async retry<T>(ctx: Context, asyncMethod: () => Promise<T>) {
        let retries = 0;
        let error: unknown;

        const retryParameters = this.retryParameters;
        while (retries < retryParameters.maxRetries) {
            try {
                return await asyncMethod();
            } catch (e) {
                if (TransportError.isMember(e)) e = TransportError.convertToYdbError(e)
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

export type RetryableResult = (target: HasLogger, propertyKey: string, descriptor: PropertyDescriptor) => void;
