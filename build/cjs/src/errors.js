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
    constructor(message, issues = []) {
        super(message);
        this.issues = issues;
    }
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
}
exports.YdbError = YdbError;
YdbError.status = StatusCode.STATUS_CODE_UNSPECIFIED;
class Unauthenticated extends YdbError {
}
exports.Unauthenticated = Unauthenticated;
Unauthenticated.status = StatusCode.UNAUTHENTICATED;
class SessionPoolEmpty extends YdbError {
}
exports.SessionPoolEmpty = SessionPoolEmpty;
SessionPoolEmpty.status = StatusCode.SESSION_POOL_EMPTY;
class BadRequest extends YdbError {
}
exports.BadRequest = BadRequest;
BadRequest.status = StatusCode.BAD_REQUEST;
class Unauthorized extends YdbError {
}
exports.Unauthorized = Unauthorized;
Unauthorized.status = StatusCode.UNAUTHORIZED;
class InternalError extends YdbError {
}
exports.InternalError = InternalError;
InternalError.status = StatusCode.INTERNAL_ERROR;
class Aborted extends YdbError {
}
exports.Aborted = Aborted;
Aborted.status = StatusCode.ABORTED;
class Unavailable extends YdbError {
}
exports.Unavailable = Unavailable;
Unavailable.status = StatusCode.UNAVAILABLE;
class Overloaded extends YdbError {
}
exports.Overloaded = Overloaded;
Overloaded.status = StatusCode.OVERLOADED;
class SchemeError extends YdbError {
}
exports.SchemeError = SchemeError;
SchemeError.status = StatusCode.SCHEME_ERROR;
class GenericError extends YdbError {
}
exports.GenericError = GenericError;
GenericError.status = StatusCode.GENERIC_ERROR;
class BadSession extends YdbError {
}
exports.BadSession = BadSession;
BadSession.status = StatusCode.BAD_SESSION;
class Timeout extends YdbError {
}
exports.Timeout = Timeout;
Timeout.status = StatusCode.TIMEOUT;
class PreconditionFailed extends YdbError {
}
exports.PreconditionFailed = PreconditionFailed;
PreconditionFailed.status = StatusCode.PRECONDITION_FAILED;
class NotFound extends YdbError {
}
exports.NotFound = NotFound;
NotFound.status = StatusCode.NOT_FOUND;
class AlreadyExists extends YdbError {
}
exports.AlreadyExists = AlreadyExists;
AlreadyExists.status = StatusCode.ALREADY_EXISTS;
class SessionExpired extends YdbError {
}
exports.SessionExpired = SessionExpired;
SessionExpired.status = StatusCode.SESSION_EXPIRED;
class Cancelled extends YdbError {
}
exports.Cancelled = Cancelled;
Cancelled.status = StatusCode.CANCELLED;
class Undetermined extends YdbError {
}
exports.Undetermined = Undetermined;
Undetermined.status = StatusCode.UNDETERMINED;
class Unsupported extends YdbError {
}
exports.Unsupported = Unsupported;
Unsupported.status = StatusCode.UNSUPPORTED;
class SessionBusy extends YdbError {
}
exports.SessionBusy = SessionBusy;
SessionBusy.status = StatusCode.SESSION_BUSY;
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
}
exports.TransportUnavailable = TransportUnavailable;
TransportUnavailable.status = StatusCode.TRANSPORT_UNAVAILABLE;
class ClientDeadlineExceeded extends TransportError {
}
exports.ClientDeadlineExceeded = ClientDeadlineExceeded;
ClientDeadlineExceeded.status = StatusCode.CLIENT_DEADLINE_EXCEEDED;
class ClientResourceExhausted extends TransportError {
}
exports.ClientResourceExhausted = ClientResourceExhausted;
ClientResourceExhausted.status = StatusCode.CLIENT_RESOURCE_EXHAUSTED;
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
