import {YdbError} from "../errors";

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
        public uncertainRatio = 0.5,
    ) {
    }

    calcBackoffTimeout(retries: number) {
        const slotsCount = 1 << Math.min(retries, this.backoffCeiling);
        const maxDuration = slotsCount * this.backoffSlotDuration;
        const duration = maxDuration * (1 - Math.random() * this.uncertainRatio);
        return duration;
    }
}

export class RetryParameters {
    public timeout: number = 0;
    /**
     * @deprecated Something from the past. Now the NotFound error processing is specified in the error description.
     */
    public retryNotFound: boolean;
    /**
     * @deprecated Not supported in the new retryer - no useful life example
     */
    public unknownErrorHandler: (_error: unknown) => void; // TODO: Impl
    /**
     * @deprecated Now attempts are not limited by number of attempts, but may be limited by timeout.
     */
    public maxRetries: number;
    /**
     * @deprecated Not supported in the new retryer - no useful life example
     */
    public onYdbErrorCb: (_error: YdbError) => void; // TODO: Impl
    public fastBackoff: BackoffSettings;
    public slowBackoff: BackoffSettings;

    constructor(opts?: {
        /**
         * @deprecated to be consistent with other YDB SDKes, the retryer is now NOT limited by the number of attempts, but
         * by the time to attempt the operation. Use timeout parameter
         */
        maxRetries?: number,
        onYdbErrorCb?: (_error: YdbError) => void,
        backoffCeiling?: number,
        backoffSlotDuration?: number,
        timeout?: number,
    }) {
        if (opts?.hasOwnProperty('timeout') && opts.timeout! > 0) this.timeout = opts.timeout!;

        this.maxRetries = opts?.maxRetries ?? 0;
        this.onYdbErrorCb = opts?.onYdbErrorCb ?? ((_error: YdbError) => {
        });
        this.fastBackoff = new BackoffSettings(10, 5);
        this.slowBackoff = new BackoffSettings(opts?.backoffCeiling ?? 6, opts?.backoffSlotDuration ?? 1000);

        this.retryNotFound = true;
        this.unknownErrorHandler = () => {};
    }
}
