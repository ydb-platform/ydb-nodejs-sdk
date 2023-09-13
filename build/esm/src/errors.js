"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoutExpired = exports.MissingStatus = exports.MissingValue = exports.MissingOperation = exports.ClientResourceExhausted = exports.ClientDeadlineExceeded = exports.TransportUnavailable = exports.TransportError = exports.SessionBusy = exports.Unsupported = exports.Undetermined = exports.Cancelled = exports.SessionExpired = exports.AlreadyExists = exports.NotFound = exports.PreconditionFailed = exports.Timeout = exports.BadSession = exports.GenericError = exports.SchemeError = exports.Overloaded = exports.Unavailable = exports.Aborted = exports.InternalError = exports.Unauthorized = exports.BadRequest = exports.SessionPoolEmpty = exports.Unauthenticated = exports.YdbError = exports.StatusCode = void 0;
const ydb_sdk_proto_1 = require("ydb-sdk-proto");
var ApiStatusCode = ydb_sdk_proto_1.Ydb.StatusIds.StatusCode;
const constants_1 = require("@grpc/grpc-js/build/src/constants");
const TRANSPORT_STATUSES_FIRST = 401000;
const CLIENT_STATUSES_FIRST = 402000;
var StatusCode;
(function (StatusCode) {
    StatusCode[StatusCode["STATUS_CODE_UNSPECIFIED"] = 0] = "STATUS_CODE_UNSPECIFIED";
    StatusCode[StatusCode["SUCCESS"] = 400000] = "SUCCESS";
    StatusCode[StatusCode["BAD_REQUEST"] = 400010] = "BAD_REQUEST";
    StatusCode[StatusCode["UNAUTHORIZED"] = 400020] = "UNAUTHORIZED";
    StatusCode[StatusCode["INTERNAL_ERROR"] = 400030] = "INTERNAL_ERROR";
    StatusCode[StatusCode["ABORTED"] = 400040] = "ABORTED";
    StatusCode[StatusCode["UNAVAILABLE"] = 400050] = "UNAVAILABLE";
    StatusCode[StatusCode["OVERLOADED"] = 400060] = "OVERLOADED";
    StatusCode[StatusCode["SCHEME_ERROR"] = 400070] = "SCHEME_ERROR";
    StatusCode[StatusCode["GENERIC_ERROR"] = 400080] = "GENERIC_ERROR";
    StatusCode[StatusCode["TIMEOUT"] = 400090] = "TIMEOUT";
    StatusCode[StatusCode["BAD_SESSION"] = 400100] = "BAD_SESSION";
    StatusCode[StatusCode["PRECONDITION_FAILED"] = 400120] = "PRECONDITION_FAILED";
    StatusCode[StatusCode["ALREADY_EXISTS"] = 400130] = "ALREADY_EXISTS";
    StatusCode[StatusCode["NOT_FOUND"] = 400140] = "NOT_FOUND";
    StatusCode[StatusCode["SESSION_EXPIRED"] = 400150] = "SESSION_EXPIRED";
    StatusCode[StatusCode["CANCELLED"] = 400160] = "CANCELLED";
    StatusCode[StatusCode["UNDETERMINED"] = 400170] = "UNDETERMINED";
    StatusCode[StatusCode["UNSUPPORTED"] = 400180] = "UNSUPPORTED";
    StatusCode[StatusCode["SESSION_BUSY"] = 400190] = "SESSION_BUSY";
    // Client statuses
    /** Cannot connect or unrecoverable network error. (map from gRPC UNAVAILABLE) */
    StatusCode[StatusCode["TRANSPORT_UNAVAILABLE"] = TRANSPORT_STATUSES_FIRST + 10] = "TRANSPORT_UNAVAILABLE";
    // Theoritically should begin with `TRANSPORT_`, but renamed due to compatibility
    StatusCode[StatusCode["CLIENT_RESOURCE_EXHAUSTED"] = TRANSPORT_STATUSES_FIRST + 20] = "CLIENT_RESOURCE_EXHAUSTED";
    StatusCode[StatusCode["CLIENT_DEADLINE_EXCEEDED"] = TRANSPORT_STATUSES_FIRST + 30] = "CLIENT_DEADLINE_EXCEEDED";
    StatusCode[StatusCode["UNAUTHENTICATED"] = CLIENT_STATUSES_FIRST + 30] = "UNAUTHENTICATED";
    StatusCode[StatusCode["SESSION_POOL_EMPTY"] = CLIENT_STATUSES_FIRST + 40] = "SESSION_POOL_EMPTY";
})(StatusCode = exports.StatusCode || (exports.StatusCode = {}));
class YdbError extends Error {
    static formatIssues(issues) {
        return issues ? JSON.stringify(issues, null, 2) : '';
    }
    static checkStatus(operation) {
        if (!operation.status) {
            throw new MissingStatus('Missing status!');
        }
        const status = operation.status;
        if (operation.status && !SUCCESS_CODES.has(status)) {
            const ErrCls = SERVER_SIDE_ERROR_CODES.get(status);
            if (!ErrCls) {
                throw new Error(`Unexpected status code ${status}!`);
            }
            else {
                throw new ErrCls(`${ErrCls.name} (code ${status}): ${YdbError.formatIssues(operation.issues)}`, operation.issues);
            }
        }
    }
    static status = StatusCode.STATUS_CODE_UNSPECIFIED;
    issues;
    constructor(message, issues = []) {
        super(message);
        this.issues = issues;
    }
}
exports.YdbError = YdbError;
class Unauthenticated extends YdbError {
    static status = StatusCode.UNAUTHENTICATED;
}
exports.Unauthenticated = Unauthenticated;
class SessionPoolEmpty extends YdbError {
    static status = StatusCode.SESSION_POOL_EMPTY;
}
exports.SessionPoolEmpty = SessionPoolEmpty;
class BadRequest extends YdbError {
    static status = StatusCode.BAD_REQUEST;
}
exports.BadRequest = BadRequest;
class Unauthorized extends YdbError {
    static status = StatusCode.UNAUTHORIZED;
}
exports.Unauthorized = Unauthorized;
class InternalError extends YdbError {
    static status = StatusCode.INTERNAL_ERROR;
}
exports.InternalError = InternalError;
class Aborted extends YdbError {
    static status = StatusCode.ABORTED;
}
exports.Aborted = Aborted;
class Unavailable extends YdbError {
    static status = StatusCode.UNAVAILABLE;
}
exports.Unavailable = Unavailable;
class Overloaded extends YdbError {
    static status = StatusCode.OVERLOADED;
}
exports.Overloaded = Overloaded;
class SchemeError extends YdbError {
    static status = StatusCode.SCHEME_ERROR;
}
exports.SchemeError = SchemeError;
class GenericError extends YdbError {
    static status = StatusCode.GENERIC_ERROR;
}
exports.GenericError = GenericError;
class BadSession extends YdbError {
    static status = StatusCode.BAD_SESSION;
}
exports.BadSession = BadSession;
class Timeout extends YdbError {
    static status = StatusCode.TIMEOUT;
}
exports.Timeout = Timeout;
class PreconditionFailed extends YdbError {
    static status = StatusCode.PRECONDITION_FAILED;
}
exports.PreconditionFailed = PreconditionFailed;
class NotFound extends YdbError {
    static status = StatusCode.NOT_FOUND;
}
exports.NotFound = NotFound;
class AlreadyExists extends YdbError {
    static status = StatusCode.ALREADY_EXISTS;
}
exports.AlreadyExists = AlreadyExists;
class SessionExpired extends YdbError {
    static status = StatusCode.SESSION_EXPIRED;
}
exports.SessionExpired = SessionExpired;
class Cancelled extends YdbError {
    static status = StatusCode.CANCELLED;
}
exports.Cancelled = Cancelled;
class Undetermined extends YdbError {
    static status = StatusCode.UNDETERMINED;
}
exports.Undetermined = Undetermined;
class Unsupported extends YdbError {
    static status = StatusCode.UNSUPPORTED;
}
exports.Unsupported = Unsupported;
class SessionBusy extends YdbError {
    static status = StatusCode.SESSION_BUSY;
}
exports.SessionBusy = SessionBusy;
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
]);
class TransportError extends YdbError {
    /** Check if error is member of GRPC error */
    static isMember(e) {
        return e instanceof Error && 'code' in e && 'details' in e && 'metadata' in e;
    }
    static convertToYdbError(e) {
        const ErrCls = TRANSPORT_ERROR_CODES.get(e.code);
        if (!ErrCls) {
            let errStr = `Can't convert grpc error to string`;
            try {
                errStr = JSON.stringify(e);
            }
            catch (error) { }
            throw new Error(`Unexpected transport error code ${e.code}! Error itself: ${errStr}`);
        }
        else {
            return new ErrCls(`${ErrCls.name} (code ${ErrCls.status}): ${e.name}: ${e.message}. ${e.details}`);
        }
    }
}
exports.TransportError = TransportError;
class TransportUnavailable extends TransportError {
    static status = StatusCode.TRANSPORT_UNAVAILABLE;
}
exports.TransportUnavailable = TransportUnavailable;
class ClientDeadlineExceeded extends TransportError {
    static status = StatusCode.CLIENT_DEADLINE_EXCEEDED;
}
exports.ClientDeadlineExceeded = ClientDeadlineExceeded;
class ClientResourceExhausted extends TransportError {
    static status = StatusCode.CLIENT_RESOURCE_EXHAUSTED;
}
exports.ClientResourceExhausted = ClientResourceExhausted;
const TRANSPORT_ERROR_CODES = new Map([
    [constants_1.Status.UNAVAILABLE, TransportUnavailable],
    [constants_1.Status.DEADLINE_EXCEEDED, ClientDeadlineExceeded],
    [constants_1.Status.RESOURCE_EXHAUSTED, ClientResourceExhausted]
]);
class MissingOperation extends YdbError {
}
exports.MissingOperation = MissingOperation;
class MissingValue extends YdbError {
}
exports.MissingValue = MissingValue;
class MissingStatus extends YdbError {
}
exports.MissingStatus = MissingStatus;
class TimeoutExpired extends YdbError {
}
exports.TimeoutExpired = TimeoutExpired;
