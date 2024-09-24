import {RetryLambdaResult} from "./retryStrategy";
import {TransportError} from "../errors";

export async function asIdempotentRetryableLambda<T>(fn: () => Promise<T>): Promise<RetryLambdaResult<T>> {
    try {
        const result = await fn();
        return {result, idempotent: true};
    } catch (err) {
        if (TransportError.isMember(err)) err = TransportError.convertToYdbError(err);
        return {err: err! as Error, idempotent: true};
    }
}
