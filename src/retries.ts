import {YdbError} from "./errors";
import * as errors from './errors';


export class RetryParameters {
    public retryNotFound: boolean;
    public retryInternalError: boolean;
    public unknownErrorHandler: (_error: Error) => void;
    public maxRetries: number;
    public onYdbErrorCb: (_error: Error) => void;
    public backoffCeiling: number;
    public backoffSlotDuration: number;

    constructor(
        {
            maxRetries = 10,
            onYdbErrorCb = (_error: Error) => {},
            backoffCeiling = 6,
            backoffSlotDuration = 1,
        } = {}
    ) {
        this.maxRetries = maxRetries;
        this.onYdbErrorCb = onYdbErrorCb;
        this.backoffCeiling = backoffCeiling;
        this.backoffSlotDuration = backoffSlotDuration;

        this.retryNotFound = true;
        this.retryInternalError = true;
        this.unknownErrorHandler = () => {};
    }
}

const RETRYABLE_ERRORS = [
    errors.Unavailable, errors.Aborted, errors.BadSession, errors.NotFound, errors.InternalError
];
const RETRYABLE_W_DELAY_ERRORS = [errors.Overloaded, errors.ConnectionError];

class RetryStrategy {
    constructor(
        public methodName = 'UnknownClass::UnknownMethod',
        public retryParameters: RetryParameters
    ) {}

    static async waitBackoffTimeout(retryParameters: RetryParameters, retries: number) {
        const slotsCount = 1 << Math.min(retries, retryParameters.backoffCeiling);
        const maxDuration = slotsCount * retryParameters.backoffSlotDuration;
        const duration = Math.random() * maxDuration;
        return new Promise((resolve) => {
            setTimeout(resolve, duration);
        });
    }

    async retry(asyncMethod: () => Promise<any>) {
        let retries = 0;
        let error: YdbError|null = null;
        const retryParameters = this.retryParameters;
        while (retries < retryParameters.maxRetries) {
            try {
                return await asyncMethod();
            } catch (e) {
                error = e;
                if (RETRYABLE_ERRORS.some((cls) => e instanceof cls)) {
                    retryParameters.onYdbErrorCb(e);

                    if (e instanceof errors.NotFound && !retryParameters.retryNotFound) {
                        throw e;
                    }

                    if (e instanceof errors.InternalError && !retryParameters.retryInternalError) {
                        throw e;
                    }
                } else if (RETRYABLE_W_DELAY_ERRORS.some((cls) => e instanceof cls)) {
                    retryParameters.onYdbErrorCb(e);

                    await RetryStrategy.waitBackoffTimeout(retryParameters, retries);
                } else if (e instanceof YdbError) {
                    retryParameters.onYdbErrorCb(e);
                    throw e;
                } else {
                    retryParameters.unknownErrorHandler(e);
                    throw e;
                }
            }
            retries++;
        }
        if (error) {
            throw error;
        }
    }
}

export function retryable(strategyParams?: RetryParameters) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;
        const wrappedMethodName = `${target.constructor.name}::${propertyKey}`;
        if (!strategyParams) {
            strategyParams = new RetryParameters();
        }
        const strategy = new RetryStrategy(wrappedMethodName, strategyParams);
        descriptor.value = async function (...args: any) {
            return await strategy.retry(
                async () => await originalMethod.call(this, ...args)
            );
        };
    };
}
