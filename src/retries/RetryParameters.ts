import { YdbError } from '../errors';
import { BackoffSettings } from './BackoffSettings';

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
