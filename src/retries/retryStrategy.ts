import {Backoff, ClientCancelled, SpecificErrorRetryPolicy, YdbError} from "./errors";
import {HasLogger} from "../logger/has-logger";
import {Logger} from "../logger/simple-logger";
import {RetryParameters} from "./retryParameters";
import {Context} from "../context/Context";
import {RetryPolicySymbol} from "./symbols";

export interface RetryDelta<T> {
    (ctx: Context, attemptsCount: number, logger: Logger): Promise<{
        result?: T,
        err?: YdbError, // YdbError errors are not get thrown since to retry we also need to know is operation is idempotent
        idempotent?: boolean
    }>;
}

export class RetryStrategy implements HasLogger {
    constructor(
        // public methodName = 'UnknownClass::UnknownMethod',
        public retryParameters: RetryParameters,
        public readonly logger: Logger
    ) {
    }

    // @EnsureContext(true)
    public async retry<T>(
        ctx: Context,
        fn: RetryDelta<T>
    ): Promise<T> {
        let attemptsCounter: number = 0;
        let prevError: YdbError | undefined;
        let sameErrorCount: number = 0;
        while (true) {
            const r = await fn(ctx, attemptsCounter++, this.logger);
            // TODO: retryParameters.onYdbErrorCb(e);
            // TODO: log debug messages
            // TODO: repleca retries in a test
            // TODO: pessinizable
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
}

export type RetryableResult = (target: HasLogger, propertyKey: string, descriptor: PropertyDescriptor) => void;
