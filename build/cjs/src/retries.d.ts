import { YdbError } from './errors';
import { Logger } from './logging';
export declare class BackoffSettings {
    backoffCeiling: number;
    backoffSlotDuration: number;
    private uncertainRatio;
    /**
     * Create backoff settings - uses randomized exponential timeouts with a base of 2
     * Timeout formula: `2^min(retries, backoffCeiling) * backoffSlotDuration * (1 - random() * uncertainRatio)`
     * @param backoffCeiling - max power — (n) in `2^n`
     * @param backoffSlotDuration - multiplier for exponent
     * @param uncertainRatio - timeout fraction that is randomized
     */
    constructor(backoffCeiling: number, backoffSlotDuration: number, uncertainRatio?: number);
    waitBackoffTimeout(retries: number): Promise<void>;
}
export declare class RetryParameters {
    retryNotFound: boolean;
    unknownErrorHandler: (_error: unknown) => void;
    maxRetries: number;
    onYdbErrorCb: (_error: YdbError) => void;
    fastBackoff: BackoffSettings;
    slowBackoff: BackoffSettings;
    constructor({ maxRetries, onYdbErrorCb, backoffCeiling, backoffSlotDuration, }?: {
        maxRetries?: number | undefined;
        onYdbErrorCb?: ((_error: YdbError) => void) | undefined;
        backoffCeiling?: number | undefined;
        backoffSlotDuration?: number | undefined;
    });
}
export declare function retryable(strategyParams?: RetryParameters, retryStrategyLogger?: Logger): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;
export declare function withRetries<T>(originalFunction: () => Promise<T>, strategyParams?: RetryParameters): Promise<T>;
