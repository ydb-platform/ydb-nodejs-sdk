import {Ydb} from '../proto/bundle';
import StatusCode = Ydb.StatusIds.StatusCode;


export class YdbError extends Error {
    get isRetryable() {
        return false;
    }
}

export class MissingOperation extends YdbError {}

export class MissingValue extends YdbError {}

export class MissingStatus extends YdbError {}

export class TimeoutExpired extends YdbError {}

export class OperationError extends YdbError {
    constructor(message: string, public code: StatusCode) {
        super(message);
    }

    get isRetryable() {
        return this.code === StatusCode.OVERLOADED || this.code === StatusCode.UNAVAILABLE;
    }
}
