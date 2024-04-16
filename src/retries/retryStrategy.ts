import * as errors from "./errors";
import {Backoff, ClientCancelled, SpecificErrorRetryPolicy, YdbError} from "./errors";
import {HasLogger} from "../logger/has-logger";
import {Logger} from "../logger/simple-logger";
import {RetryParameters} from "./retryParameters";
import {Context} from "../context/Context";
import {EnsureContext} from "../context/EnsureContext";
import {RetryPolicySymbol, RetrySymbol} from "./symbols";

export interface RetryDelta<T> {
    (ctx: Context, attemptCount: number, logger: Logger): {
        result?: T,
        err?: YdbError, // YdbError errors are not get thrown since to retry we also need to know is operation is idempotent
        idempotent?: boolean
    }
}

export class RetryStrategy implements HasLogger {
    constructor(
        // public methodName = 'UnknownClass::UnknownMethod',
        public retryParameters: RetryParameters,
        public readonly logger: Logger
    ) {
    }

    @EnsureContext(true)
    public async retry<T>(
        ctx: Context,
        fn: RetryDelta<T>
    ): Promise<T> {
        let attemptsCounter: number = 0;
        let prevError: YdbError | undefined;
        let sameErrorCount: number = 0;
        while (true) {
            const r = fn(ctx, attemptsCounter++, this.retryParameters.logger);
            if (r.err) {
                // Note: deleteSession suppose to be processed in delta function
                const retryPolicy = (r.err as any).constructor[RetryPolicySymbol] as SpecificErrorRetryPolicy;
                const doRetry = r.idempotent ? retryPolicy.idempotent : retryPolicy.nonIdempotent;
                if (doRetry) {
                    if (retryPolicy.backoff === Backoff.No) continue; // immediate retry
                    if (r.err === prevError) { // same repeating Error slows down retries exponentially
                        sameErrorCount++;
                    } else {
                        prevError = r.err;
                        sameErrorCount = 0;
                    }
                    const backoff = retryPolicy.backoff === Backoff.Fast
                        ? this.retryParameters.fastBackoff
                        : this.retryParameters.slowBackoff;
                    await backoff.waitBackoffTimeout(sameErrorCount);
                }
                if (ctx.err) { // here to make sure that operation was not cancelled while awaiting retry time
                    throw new ClientCancelled(ctx.err);
                }
                throw r.err;
            }
            return r.result!;
        }
    }

    // @EnsureContext(true)
    // async retry<T>(ctx: Context, asyncMethod: () => Promise<T>) {
    //     let retries = 0;
    //     let error: unknown;
    //
    //     const retryParameters = this.retryParameters;
    //     while (retries < retryParameters.maxRetries) {
    //         try {
    //             return await asyncMethod();
    //         } catch (e) {
    //             if (TransportError.isMember(e)) e = TransportError.convertToYdbError(e)
    //             error = e;
    //             if (e instanceof YdbError) {
    //                 const errName = e.constructor.name;
    //                 const retriesLeft = retryParameters.maxRetries - retries;
    //                 if (RETRYABLE_ERRORS_FAST.some((cls) => e instanceof cls)) {
    //                     retryParameters.onYdbErrorCb(e);
    //                     if (e instanceof errors.NotFound && !retryParameters.retryNotFound) {
    //                         throw e;
    //                     }
    //                     this.logger.warn(
    //                         `Caught an error ${errName}, retrying with fast backoff, ${retriesLeft} retries left`,
    //                     );
    //                     await this.retryParameters.fastBackoff.waitBackoffTimeout(retries);
    //                 } else if (RETRYABLE_ERRORS_SLOW.some((cls) => e instanceof cls)) {
    //                     retryParameters.onYdbErrorCb(e);
    //
    //                     this.logger.warn(
    //                         `Caught an error ${errName}, retrying with slow backoff, ${retriesLeft} retries left`,
    //                     );
    //                     await this.retryParameters.slowBackoff.waitBackoffTimeout(retries);
    //                 } else {
    //                     retryParameters.onYdbErrorCb(e);
    //                     throw e;
    //                 }
    //             } else {
    //                 retryParameters.unknownErrorHandler(e);
    //                 throw e;
    //             }
    //         }
    //         retries++;
    //     }
    //     this.logger.warn('All retries have been used, re-throwing error');
    //     throw error;
    // }
}

export type RetryableResult = (target: HasLogger, propertyKey: string, descriptor: PropertyDescriptor) => void;
