import * as utils from "../utils";
import {YdbError} from "./errors";

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
    ) {
    }

    async waitBackoffTimeout(retries: number) {
        const slotsCount = 1 << Math.min(retries, this.backoffCeiling);
        const maxDuration = slotsCount * this.backoffSlotDuration;
        const duration = maxDuration * (1 - Math.random() * this.uncertainRatio);
        return utils.sleep(duration);
    }
}

export class RetryParameters {
    public timeout: number = 0;
    public retryNotFound: boolean;
    public unknownErrorHandler: (_error: unknown) => void;
    public maxRetries: number;
    public onYdbErrorCb: (_error: YdbError) => void;
    public fastBackoff: BackoffSettings;
    public slowBackoff: BackoffSettings;

    constructor(opts?: {
        /**
         * @deprecated to be consistent with other YDB SDKes, the repeater is now limited not by the number of attempts, but
         * by the time to attempt the operation. use timeout parameter
         */
        maxRetries?: number, // TODO: Obsoleted
        onYdbErrorCb?: (_error: YdbError) => void, // TODO: Where is in use
        backoffCeiling?: number,
        backoffSlotDuration?: number,
        timeout?: number,
    }) {
        if (opts?.hasOwnProperty('timeout') && opts.timeout! > 0) this.timeout = opts.timeout!;

        this.maxRetries = opts?.maxRetries ?? 10;
        this.onYdbErrorCb = opts?.onYdbErrorCb ?? ((_error: YdbError) => {
        });
        this.fastBackoff = new BackoffSettings(10, 5);
        this.slowBackoff = new BackoffSettings(opts?.backoffCeiling ?? 6, opts?.backoffSlotDuration ?? 1000);

        this.retryNotFound = true;
        this.unknownErrorHandler = () => {};
    }
}
