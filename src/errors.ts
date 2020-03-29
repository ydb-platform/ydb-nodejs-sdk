import {Ydb} from '../proto/bundle';
import ApiStatusCode = Ydb.StatusIds.StatusCode;
import IOperation = Ydb.Operations.IOperation;


const TRANSPORT_STATUSES_FIRST = 401000;
const CLIENT_STATUSES_FIRST = 402000;

export enum StatusCode {
    STATUS_CODE_UNSPECIFIED = ApiStatusCode.STATUS_CODE_UNSPECIFIED,
    SUCCESS = ApiStatusCode.SUCCESS,
    BAD_REQUEST = ApiStatusCode.BAD_REQUEST,
    UNAUTHORIZED = ApiStatusCode.UNAUTHORIZED,
    INTERNAL_ERROR = ApiStatusCode.INTERNAL_ERROR,
    ABORTED = ApiStatusCode.ABORTED,
    UNAVAILABLE = ApiStatusCode.UNAVAILABLE,
    OVERLOADED = ApiStatusCode.OVERLOADED,
    SCHEME_ERROR = ApiStatusCode.SCHEME_ERROR,
    GENERIC_ERROR = ApiStatusCode.GENERIC_ERROR,
    TIMEOUT = ApiStatusCode.TIMEOUT,
    BAD_SESSION = ApiStatusCode.BAD_SESSION,
    PRECONDITION_FAILED = ApiStatusCode.PRECONDITION_FAILED,
    ALREADY_EXISTS = ApiStatusCode.ALREADY_EXISTS,
    NOT_FOUND = ApiStatusCode.NOT_FOUND,
    SESSION_EXPIRED = ApiStatusCode.SESSION_EXPIRED,
    CANCELLED = ApiStatusCode.CANCELLED,
    UNDETERMINED = ApiStatusCode.UNDETERMINED,
    UNSUPPORTED = ApiStatusCode.UNSUPPORTED,

    CONNECTION_LOST = TRANSPORT_STATUSES_FIRST + 10,
    CONNECTION_FAILURE = TRANSPORT_STATUSES_FIRST + 20,
    DEADLINE_EXCEEDED = TRANSPORT_STATUSES_FIRST + 30,
    CLIENT_INTERNAL_ERROR = TRANSPORT_STATUSES_FIRST + 40,
    UNIMPLEMENTED = TRANSPORT_STATUSES_FIRST + 50,

    UNAUTHENTICATED = CLIENT_STATUSES_FIRST + 30,
}

export class YdbError extends Error {
    static formatIssues(issues?: null | any[]) {
        return issues ? JSON.stringify(issues, null, 2) : '';
    }

    static checkStatus(operation: IOperation) {
        if (!operation.status) {
            throw new MissingStatus('Missing status!');
        }
        const status = operation.status as unknown as StatusCode;
        if (operation.status && !SUCCESS_CODES.has(status)) {
            const ErrCls = SERVER_SIDE_ERROR_CODES.get(status);

            if (!ErrCls) {
                throw new Error(`Unexpected status code ${status}!`);
            } else {
                throw new ErrCls(`${ErrCls.name}: ${YdbError.formatIssues(operation.issues)}`, operation.issues);
            }
        }
    }

    public status: number | null = null;
    public issues: any[] | null;

    constructor(message: string, issues: null | any[] = []) {
        super(message);
        this.issues = issues;
    }
}

export class ConnectionError extends YdbError {}
export class ConnectionFailure extends ConnectionError {
    status = StatusCode.CONNECTION_FAILURE
}
export class ConnectionLost extends ConnectionError {
    status = StatusCode.CONNECTION_LOST
}
export class DeadlineExceed extends ConnectionError {
    status = StatusCode.DEADLINE_EXCEEDED
}
export class Unimplemented extends ConnectionError {
    status = StatusCode.UNIMPLEMENTED
}

export class Unauthenticated extends YdbError {
    status = StatusCode.UNAUTHENTICATED
}

export class BadRequest extends YdbError {
    status = StatusCode.BAD_REQUEST
}

export class Unauthorized extends YdbError {
    status = StatusCode.UNAUTHORIZED
}

export class InternalError extends YdbError {
    status = StatusCode.INTERNAL_ERROR
}

export class Aborted extends YdbError {
    status = StatusCode.ABORTED
}

export class Unavailable extends YdbError {
    status = StatusCode.UNAVAILABLE
}

export class Overloaded extends YdbError {
    status = StatusCode.OVERLOADED
}

export class SchemeError extends YdbError {
    status = StatusCode.SCHEME_ERROR
}

export class GenericError extends YdbError {
    status = StatusCode.GENERIC_ERROR
}

export class BadSession extends YdbError {
    status = StatusCode.BAD_SESSION
}

export class Timeout extends YdbError {
    status = StatusCode.TIMEOUT
}

export class PreconditionFailed extends YdbError {
    status = StatusCode.PRECONDITION_FAILED
}

export class NotFound extends YdbError {
    status = StatusCode.NOT_FOUND
}

export class AlreadyExists extends YdbError {
    status = StatusCode.ALREADY_EXISTS
}

export class SessionExpired extends YdbError {
    status = StatusCode.SESSION_EXPIRED
}

export class Cancelled extends YdbError {
    status = StatusCode.CANCELLED
}

export class Undetermined extends YdbError {
    status = StatusCode.UNDETERMINED
}

export class Unsupported extends YdbError {
    status = StatusCode.UNSUPPORTED
}

const SUCCESS_CODES = new Set([
    StatusCode.STATUS_CODE_UNSPECIFIED,
    StatusCode.SUCCESS
]);

const SERVER_SIDE_ERROR_CODES = new Map([
    [StatusCode.BAD_REQUEST, BadRequest],
    [StatusCode.UNAUTHORIZED, Unauthorized],
    [StatusCode.INTERNAL_ERROR, InternalError],
    [StatusCode.ABORTED, Aborted],
    [StatusCode.UNAVAILABLE, Unavailable],
    [StatusCode.OVERLOADED, Overloaded],
    [StatusCode.SCHEME_ERROR, SchemeError],
    [StatusCode.GENERIC_ERROR, GenericError],
    [StatusCode.TIMEOUT, Timeout],
    [StatusCode.BAD_SESSION, BadSession],
    [StatusCode.PRECONDITION_FAILED, PreconditionFailed],
    [StatusCode.ALREADY_EXISTS, AlreadyExists],
    [StatusCode.NOT_FOUND, NotFound],
    [StatusCode.SESSION_EXPIRED, SessionExpired],
    [StatusCode.CANCELLED, Cancelled],
    [StatusCode.UNDETERMINED, Undetermined],
    [StatusCode.UNSUPPORTED, Unsupported],
]);

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
