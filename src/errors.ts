import {StatusObject as GrpcStatusObject} from '@grpc/grpc-js';
import {Ydb} from 'ydb-sdk-proto';
import ApiStatusCode = Ydb.StatusIds.StatusCode;
import {Status as GrpcStatus} from '@grpc/grpc-js/build/src/constants';
import {RetryPolicySymbol} from "./retries/symbols";

const TRANSPORT_STATUSES_FIRST = 401000;
const CLIENT_STATUSES_FIRST = 402000;

export const enum Backoff {
    No,
    Fast,
    Slow,
}

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
    SESSION_BUSY = ApiStatusCode.SESSION_BUSY,
    EXTERNAL_ERROR = ApiStatusCode.EXTERNAL_ERROR,

    // Client statuses
    /** Cannot connect or unrecoverable network error. (map from gRPC UNAVAILABLE) */
    TRANSPORT_UNAVAILABLE = TRANSPORT_STATUSES_FIRST + 10, // grpc code: 14 (GrpcStatus.UNAVAILABLE)
    // Theoritically should begin with `TRANSPORT_`, but renamed due to compatibility
    CLIENT_RESOURCE_EXHAUSTED = TRANSPORT_STATUSES_FIRST + 20, // grpc code: 8 (GrpcStatus.RESOURCE_EXHAUSTED)
    CLIENT_DEADLINE_EXCEEDED = TRANSPORT_STATUSES_FIRST + 30, // grpc code: 4 (GrpcStatus.DEADLINE_EXCEEDED)
    CLIENT_CANCELED = TRANSPORT_STATUSES_FIRST + 34, // SDK local

    UNAUTHENTICATED = CLIENT_STATUSES_FIRST + 30, // SDK local
    SESSION_POOL_EMPTY = CLIENT_STATUSES_FIRST + 40, // SDK local
}

/**
 * Depending on the type of error, the retryer decides how to proceed and whether
 * the session can continue to be used or not.
 */
export type SpecificErrorRetryPolicy = {
    /**
     * Backoff.No - retry imminently if retry for the operation is true.
     * Backoff.Fast - retry accordingly to fast retry policy.
     * Backoff.Slow - retry accordingly to slow retry policy.
     * Note: current attempt count set to zero if the error is not with the same type as was on previous attempt.
     */
    backoff: Backoff,
    /**
     * true - delete session from pool, is case of the error.
     */
    deleteSession: boolean,
    /**
     * true - retry for idempotent operations.
     */
    idempotent: boolean,
    /**
     * true - retry for non-idempotent operations.
     */
    nonIdempotent: boolean
}

function retryPolicy(backoff: Backoff, deleteSession: boolean, idempotent: boolean, nonIdempotent: boolean): SpecificErrorRetryPolicy {
    if (nonIdempotent && !idempotent) throw new Error('Senseless');
    return {backoff, deleteSession, idempotent, nonIdempotent};
}

export class YdbError extends Error {
    public static [RetryPolicySymbol]: SpecificErrorRetryPolicy;

    static formatIssues(issues?: null | any[]) {
        return issues ? JSON.stringify(issues, null, 2) : '';
    }

    /**
     * If YDB returns an error YdbError is thrown.
     * @param operation
     */
    static checkStatus(operation: {
        status?: (Ydb.StatusIds.StatusCode|null);
        issues?: (Ydb.Issue.IIssueMessage[]|null);
    }) {
        if (!operation.status) {
            throw new MissingStatus('Missing status!');
        }

        // if (operation.issues) operation.issues = YdbError.flatIssues(operation.issues);

        const status = operation.status as unknown as StatusCode;
        if (operation.status && !SUCCESS_CODES.has(status)) {
            const ErrCls = SERVER_SIDE_ERROR_CODES.get(status);

            if (!ErrCls) {
                throw new Error(`Unexpected status code ${status}!`);
            } else {
                console.info(8000, JSON.stringify(operation, null, 2));
                throw new ErrCls(`${ErrCls.name} (!!code ${status}): ${operation.issues}`, operation.issues);
            }
        }
    }

    /**
     * Issues from Ydb are returned as a tree with nested issues.  Returns the list of issues as a flat array.
     * The nested issues follow their parents.
     */
    // @ts-ignore
    private static flatIssues(issues: Ydb.Issue.IIssueMessage[]) {
        const res: Ydb.Issue.IIssueMessage[] = [];
        processLevel(issues);
        return res;
        function processLevel(issues: Ydb.Issue.IIssueMessage[]) {
            for (const issue of issues) {
                res.push(issue);
                if (issue.issues) processLevel(issue.issues);
                delete issue.issues;
            }
        }
    }

    static status = StatusCode.STATUS_CODE_UNSPECIFIED;
    public issues: any[] | null;

    constructor(message: string, issues: null | any[] = []) {
        super(message);
        this.issues = issues;
    }
}

export class StatusCodeUnspecified extends YdbError {
    static status = StatusCode.STATUS_CODE_UNSPECIFIED;
    readonly [RetryPolicySymbol] = retryPolicy(Backoff.No, false, false, false);
}

export class Unauthenticated extends YdbError {
    static status = StatusCode.UNAUTHENTICATED;
    readonly [RetryPolicySymbol] = retryPolicy(Backoff.No, true, false, false);
}

export class SessionPoolEmpty extends YdbError {
    static status = StatusCode.SESSION_POOL_EMPTY;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.Fast, false, true, true); // TODO: not found go impl yet
}

export class BadRequest extends YdbError {
    static status = StatusCode.BAD_REQUEST;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.No, false, false, false);
}

export class Unauthorized extends YdbError {
    static status = StatusCode.UNAUTHORIZED;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.No, false, false, false);
}

export class InternalError extends YdbError {
    static status = StatusCode.INTERNAL_ERROR;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.No, false, false, false);
}

export class Aborted extends YdbError {
    static status = StatusCode.ABORTED;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.Fast, false, true, true);
}

export class Unavailable extends YdbError {
    static status = StatusCode.UNAVAILABLE;
    // TODO: Requires extra logic - see https://github.com/ydb-platform/ydb-go-sdk/blob/e1ba79620427a66c1564a52abe7e1ff10787d442/retry/errors_data_test.go#L197
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.Fast, false, true, false);
}

export class Overloaded extends YdbError {
    static status = StatusCode.OVERLOADED;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.Slow, false, true, true);
}

export class SchemeError extends YdbError {
    static status = StatusCode.SCHEME_ERROR;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.No, false,false, false);
}

export class GenericError extends YdbError {
    static status = StatusCode.GENERIC_ERROR;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.No, false, false, false);
}

export class BadSession extends YdbError {
    static status = StatusCode.BAD_SESSION;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.No, true, true, true);
}

export class Timeout extends YdbError {
    static status = StatusCode.TIMEOUT;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.No, false, false, false);
}

export class PreconditionFailed extends YdbError {
    static status = StatusCode.PRECONDITION_FAILED;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.No, false, false, false)
}

export class NotFound extends YdbError {
    static status = StatusCode.NOT_FOUND;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.No, false, false, false);
}

export class AlreadyExists extends YdbError {
    static status = StatusCode.ALREADY_EXISTS;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.No, false, false, false);
}

export class SessionExpired extends YdbError {
    static status = StatusCode.SESSION_EXPIRED;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.No, true, false, false);
}

export class Cancelled extends YdbError {
    static status = StatusCode.CANCELLED;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.Fast, false, false, false);
}

export class Undetermined extends YdbError {
    static status = StatusCode.UNDETERMINED;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.Fast, false, true, false);
}

export class Unsupported extends YdbError {
    static status = StatusCode.UNSUPPORTED;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.Fast, true, true, true);
}

export class SessionBusy extends YdbError {
    static status = StatusCode.SESSION_BUSY;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.Fast, true, true, true);
}

export class ExternalError extends YdbError {
    static status = StatusCode.EXTERNAL_ERROR;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.No, false, false, true);
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
    [StatusCode.SESSION_BUSY, SessionBusy],
    [StatusCode.EXTERNAL_ERROR, ExternalError],
]);

export class TransportError extends YdbError {
    /** Check if error is member of GRPC error */
    static isMember(e: any): e is Error & GrpcStatusObject {
        return e instanceof Error && 'code' in e && 'details' in e && 'metadata' in e;
    }

    static convertToYdbError(e: Error & GrpcStatusObject): Error {

        const ErrCls = TRANSPORT_ERROR_CODES.get(e.code);

        if (!ErrCls) {
            let errStr = `Can't convert grpc error to string`;
            try {
                errStr = JSON.stringify(e);
            } catch (error) {}
            return new Error(`Unexpected transport error code ${e.code}! Error itself: ${errStr}`);
        } else {
            return new ErrCls(
                `${ErrCls.name} (code ${ErrCls.status}): ${e.name}: ${e.message}. ${e.details}`,
            );
        }
    }
}

export class TransportUnavailable extends TransportError {
    static status = StatusCode.TRANSPORT_UNAVAILABLE;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.Fast, true, true, false);
}

export class ClientDeadlineExceeded extends TransportError {
    static status = StatusCode.CLIENT_DEADLINE_EXCEEDED;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.No, false, false, false);
}

export class ClientResourceExhausted extends TransportError {
    static status = StatusCode.CLIENT_RESOURCE_EXHAUSTED;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.Slow, false, true, true);
}

const TRANSPORT_ERROR_CODES = new Map([
    [GrpcStatus.CANCELLED, Cancelled],
    [GrpcStatus.UNAVAILABLE, TransportUnavailable],
    [GrpcStatus.DEADLINE_EXCEEDED, ClientDeadlineExceeded],
    [GrpcStatus.RESOURCE_EXHAUSTED, ClientResourceExhausted]
]);

export class ClientCancelled extends YdbError {
    static status = StatusCode.CLIENT_CANCELED;
    public readonly [RetryPolicySymbol] =  retryPolicy(Backoff.No, false, false, false);

    constructor(public readonly cause: Error) {
        super(`Operation cancelled. Cause: ${cause.message}`);
    }
}

export class MissingOperation extends YdbError {}

export class MissingValue extends YdbError {}

export class MissingStatus extends YdbError {}

export class TimeoutExpired extends YdbError {} // TODO: What's the diff with ClientCancelled
