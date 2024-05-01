import {Backoff, ClientCancelled, SpecificErrorRetryPolicy} from "../errors";
import {HasLogger} from "../logger/has-logger";
import {Logger} from "../logger/simple-logger";
import {RetryParameters} from "./retryParameters";
import {Context} from "../context";
import {RetryPolicySymbol} from "./symbols";
import * as utils from "../utils";
import {
    fastBackoffRetryMessage,
    slowBackoffRetryMessage,
    immediateBackoffRetryMessage,
    successAfterNAttempts,
    notRetryableErrorMessage,
} from "./message";

export interface RetryLambdaResult<T> {
    result?: T,
    err?: Error, // YdbError errors are not get thrown since to retry we also need to know is the operation is idempotent
    idempotent?: boolean
};

export interface RetryLambda<T> {
    (ctx: Context, logger: Logger, attemptsCount: number): Promise<RetryLambdaResult<T>>;
}

export class RetryStrategy implements HasLogger {
    constructor(
        // public methodName = 'UnknownClass::UnknownMethod',
        public retryParameters: RetryParameters,
        public readonly logger: Logger
    ) {
    }

    public async retry<T>(
        ctx: Context,
        fn: RetryLambda<T>
    ): Promise<T> {
        let attemptsCounter: number = 0;
        let prevError: Error | undefined;
        let sameErrorCount: number = 0;
        while (true) {
            let r: RetryLambdaResult<T>;
            try {
                r = await fn(ctx, this.logger, attemptsCounter++);
            } catch (err) { // catch any error and process as errors with default policy = non-idempotent, not-retryable
                r = {err} as RetryLambdaResult<T>;
            }
            if (r.err) {
                // Note: deleteSession suppose to be processed in the lambda function
                const retryPolicy = (r.err as any)[RetryPolicySymbol] as SpecificErrorRetryPolicy;
                if (retryPolicy && (r.idempotent ? retryPolicy.idempotent : retryPolicy.nonIdempotent)) {
                    if (retryPolicy.backoff === Backoff.No) { // immediate retry
                        this.logger.debug(immediateBackoffRetryMessage, r.err, 1); // delay for 1 ms so fake timer can control process
                        await utils.sleep(1);
                        continue;
                    }
                    if (r.err.constructor === prevError?.constructor) { // same repeating Error slows down retries exponentially
                        sameErrorCount++;
                    } else {
                        prevError = r.err;
                        sameErrorCount = 0;
                    }
                    const backoff = retryPolicy.backoff === Backoff.Fast
                        ? this.retryParameters.fastBackoff
                        : this.retryParameters.slowBackoff;
                    const waitFor = backoff.calcBackoffTimeout(sameErrorCount);
                    this.logger.debug(retryPolicy.backoff === Backoff.Fast
                            ? fastBackoffRetryMessage
                            : slowBackoffRetryMessage
                        , r.err, waitFor);
                    await utils.sleep(waitFor);
                    continue;
                } else {
                    this.logger.debug(notRetryableErrorMessage, r.err);
                }
                if (ctx.err) { // make sure that operation was not cancelled while awaiting retry time
                    throw new ClientCancelled(ctx.err);
                }
                throw r.err;
            }
            this.logger.debug(successAfterNAttempts, attemptsCounter);
            return r.result!;
        }
    }
}

export type RetryableResult = (target: HasLogger, propertyKey: string, descriptor: PropertyDescriptor) => void;
