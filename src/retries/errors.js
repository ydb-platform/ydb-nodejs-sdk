"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoutExpired = exports.MissingStatus = exports.MissingValue = exports.MissingOperation = exports.ClientResourceExhausted = exports.ClientDeadlineExceeded = exports.TransportUnavailable = exports.TransportError = exports.SessionBusy = exports.Unsupported = exports.Undetermined = exports.Cancelled = exports.SessionExpired = exports.AlreadyExists = exports.NotFound = exports.PreconditionFailed = exports.Timeout = exports.BadSession = exports.GenericError = exports.SchemeError = exports.Overloaded = exports.Unavailable = exports.Aborted = exports.InternalError = exports.Unauthorized = exports.BadRequest = exports.SessionPoolEmpty = exports.Unauthenticated = exports.YdbError = exports.StatusCode = exports.DeleteSessionSymbol = exports.NonIdempotentBackoffSyumbol = exports.IdempotentBackoffSymbol = void 0;
var constants_1 = require("@grpc/grpc-js/build/src/constants");
var TRANSPORT_STATUSES_FIRST = 401000;
var CLIENT_STATUSES_FIRST = 402000;
exports.IdempotentBackoffSymbol = Symbol('idempotent_backoff');
exports.NonIdempotentBackoffSyumbol = Symbol('non_idempotent_backoff');
exports.DeleteSessionSymbol = Symbol('delete_session');
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
    StatusCode[StatusCode["TRANSPORT_UNAVAILABLE"] = 401010] = "TRANSPORT_UNAVAILABLE";
    // Theoritically should begin with `TRANSPORT_`, but renamed due to compatibility
    StatusCode[StatusCode["CLIENT_RESOURCE_EXHAUSTED"] = 401020] = "CLIENT_RESOURCE_EXHAUSTED";
    StatusCode[StatusCode["CLIENT_DEADLINE_EXCEEDED"] = 401030] = "CLIENT_DEADLINE_EXCEEDED";
    StatusCode[StatusCode["UNAUTHENTICATED"] = 402030] = "UNAUTHENTICATED";
    StatusCode[StatusCode["SESSION_POOL_EMPTY"] = 402040] = "SESSION_POOL_EMPTY";
})(StatusCode || (exports.StatusCode = StatusCode = {}));
var YdbError = /** @class */ (function (_super) {
    __extends(YdbError, _super);
    function YdbError(idempotentBackoff, nonIdempotentBackoff) {
        return _super.call(this) || this;
    }
    YdbError.init = function (deleteSession, idempotentBackoff, nonIdempotentBackoff) {
        this[exports.DeleteSessionSymbol] = deleteSession;
        this[exports.IdempotentBackoffSymbol] = idempotentBackoff;
        this[exports.NonIdempotentBackoffSyumbol] = nonIdempotentBackoff;
    };
    YdbError.formatIssues = function (issues) {
        return issues ? JSON.stringify(issues, null, 2) : '';
    };
    YdbError.checkStatus = function (operation) {
        if (!operation.status) {
            throw new MissingStatus('Missing status!');
        }
        if (operation.issues)
            operation.issues = YdbError.flatIssues(operation.issues);
        var status = operation.status;
        if (operation.status && !SUCCESS_CODES.has(status)) {
            var ErrCls = SERVER_SIDE_ERROR_CODES.get(status);
            if (!ErrCls) {
                throw new Error("Unexpected status code ".concat(status, "!"));
            }
            else {
                throw new ErrCls("".concat(ErrCls.name, " (code ").concat(status, "): ").concat(YdbError.formatIssues(operation.issues)), operation.issues);
            }
        }
    };
    YdbError.flatIssues = function (issues) {
        var res = [];
        processLevel(issues);
        return res;
        function processLevel(issues) {
            for (var _i = 0, issues_1 = issues; _i < issues_1.length; _i++) {
                var issue = issues_1[_i];
                res.push(issue);
                if (issue.issues)
                    processLevel(issue.issues);
                delete issue.issues;
            }
        }
    };
    YdbError.status = StatusCode.STATUS_CODE_UNSPECIFIED;
    return YdbError;
}(Error));
exports.YdbError = YdbError;
var Unauthenticated = /** @class */ (function (_super) {
    __extends(Unauthenticated, _super);
    function Unauthenticated() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Unauthenticated.status = StatusCode.UNAUTHENTICATED;
    return Unauthenticated;
}(YdbError));
exports.Unauthenticated = Unauthenticated;
var SessionPoolEmpty = /** @class */ (function (_super) {
    __extends(SessionPoolEmpty, _super);
    function SessionPoolEmpty() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SessionPoolEmpty.status = StatusCode.SESSION_POOL_EMPTY;
    return SessionPoolEmpty;
}(YdbError));
exports.SessionPoolEmpty = SessionPoolEmpty;
var BadRequest = /** @class */ (function (_super) {
    __extends(BadRequest, _super);
    function BadRequest() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    BadRequest.status = StatusCode.BAD_REQUEST;
    return BadRequest;
}(YdbError));
exports.BadRequest = BadRequest;
var Unauthorized = /** @class */ (function (_super) {
    __extends(Unauthorized, _super);
    function Unauthorized() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Unauthorized.status = StatusCode.UNAUTHORIZED;
    return Unauthorized;
}(YdbError));
exports.Unauthorized = Unauthorized;
var InternalError = /** @class */ (function (_super) {
    __extends(InternalError, _super);
    function InternalError() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    InternalError.status = StatusCode.INTERNAL_ERROR;
    return InternalError;
}(YdbError));
exports.InternalError = InternalError;
var Aborted = /** @class */ (function (_super) {
    __extends(Aborted, _super);
    function Aborted() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Aborted.status = StatusCode.ABORTED;
    return Aborted;
}(YdbError));
exports.Aborted = Aborted;
var Unavailable = /** @class */ (function (_super) {
    __extends(Unavailable, _super);
    function Unavailable() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Unavailable.status = StatusCode.UNAVAILABLE;
    return Unavailable;
}(YdbError));
exports.Unavailable = Unavailable;
var Overloaded = /** @class */ (function (_super) {
    __extends(Overloaded, _super);
    function Overloaded() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Overloaded.status = StatusCode.OVERLOADED;
    return Overloaded;
}(YdbError));
exports.Overloaded = Overloaded;
var SchemeError = /** @class */ (function (_super) {
    __extends(SchemeError, _super);
    function SchemeError() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SchemeError.status = StatusCode.SCHEME_ERROR;
    return SchemeError;
}(YdbError));
exports.SchemeError = SchemeError;
var GenericError = /** @class */ (function (_super) {
    __extends(GenericError, _super);
    function GenericError() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    GenericError.status = StatusCode.GENERIC_ERROR;
    return GenericError;
}(YdbError));
exports.GenericError = GenericError;
var BadSession = /** @class */ (function (_super) {
    __extends(BadSession, _super);
    function BadSession() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    BadSession.status = StatusCode.BAD_SESSION;
    return BadSession;
}(YdbError));
exports.BadSession = BadSession;
var Timeout = /** @class */ (function (_super) {
    __extends(Timeout, _super);
    function Timeout() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Timeout.status = StatusCode.TIMEOUT;
    return Timeout;
}(YdbError));
exports.Timeout = Timeout;
var PreconditionFailed = /** @class */ (function (_super) {
    __extends(PreconditionFailed, _super);
    function PreconditionFailed() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PreconditionFailed.status = StatusCode.PRECONDITION_FAILED;
    return PreconditionFailed;
}(YdbError));
exports.PreconditionFailed = PreconditionFailed;
var NotFound = /** @class */ (function (_super) {
    __extends(NotFound, _super);
    function NotFound() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    NotFound.status = StatusCode.NOT_FOUND;
    return NotFound;
}(YdbError));
exports.NotFound = NotFound;
var AlreadyExists = /** @class */ (function (_super) {
    __extends(AlreadyExists, _super);
    function AlreadyExists() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AlreadyExists.status = StatusCode.ALREADY_EXISTS;
    return AlreadyExists;
}(YdbError));
exports.AlreadyExists = AlreadyExists;
var SessionExpired = /** @class */ (function (_super) {
    __extends(SessionExpired, _super);
    function SessionExpired() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SessionExpired.status = StatusCode.SESSION_EXPIRED;
    return SessionExpired;
}(YdbError));
exports.SessionExpired = SessionExpired;
var Cancelled = /** @class */ (function (_super) {
    __extends(Cancelled, _super);
    function Cancelled() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Cancelled.status = StatusCode.CANCELLED;
    return Cancelled;
}(YdbError));
exports.Cancelled = Cancelled;
var Undetermined = /** @class */ (function (_super) {
    __extends(Undetermined, _super);
    function Undetermined() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Undetermined.status = StatusCode.UNDETERMINED;
    return Undetermined;
}(YdbError));
exports.Undetermined = Undetermined;
var Unsupported = /** @class */ (function (_super) {
    __extends(Unsupported, _super);
    function Unsupported() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Unsupported.status = StatusCode.UNSUPPORTED;
    return Unsupported;
}(YdbError));
exports.Unsupported = Unsupported;
var SessionBusy = /** @class */ (function (_super) {
    __extends(SessionBusy, _super);
    function SessionBusy() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SessionBusy.status = StatusCode.SESSION_BUSY;
    return SessionBusy;
}(YdbError));
exports.SessionBusy = SessionBusy;
var SUCCESS_CODES = new Set([
    StatusCode.STATUS_CODE_UNSPECIFIED,
    StatusCode.SUCCESS
]);
var SERVER_SIDE_ERROR_CODES = new Map([
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
var TransportError = /** @class */ (function (_super) {
    __extends(TransportError, _super);
    function TransportError() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /** Check if error is member of GRPC error */
    TransportError.isMember = function (e) {
        return e instanceof Error && 'code' in e && 'details' in e && 'metadata' in e;
    };
    TransportError.convertToYdbError = function (e) {
        var ErrCls = TRANSPORT_ERROR_CODES.get(e.code);
        if (!ErrCls) {
            var errStr = "Can't convert grpc error to string";
            try {
                errStr = JSON.stringify(e);
            }
            catch (error) { }
            throw new Error("Unexpected transport error code ".concat(e.code, "! Error itself: ").concat(errStr));
        }
        else {
            return new ErrCls("".concat(ErrCls.name, " (code ").concat(ErrCls.status, "): ").concat(e.name, ": ").concat(e.message, ". ").concat(e.details));
        }
    };
    return TransportError;
}(YdbError));
exports.TransportError = TransportError;
var TransportUnavailable = /** @class */ (function (_super) {
    __extends(TransportUnavailable, _super);
    function TransportUnavailable() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    TransportUnavailable.status = StatusCode.TRANSPORT_UNAVAILABLE;
    return TransportUnavailable;
}(TransportError));
exports.TransportUnavailable = TransportUnavailable;
var ClientDeadlineExceeded = /** @class */ (function (_super) {
    __extends(ClientDeadlineExceeded, _super);
    function ClientDeadlineExceeded() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ClientDeadlineExceeded.status = StatusCode.CLIENT_DEADLINE_EXCEEDED;
    return ClientDeadlineExceeded;
}(TransportError));
exports.ClientDeadlineExceeded = ClientDeadlineExceeded;
var ClientResourceExhausted = /** @class */ (function (_super) {
    __extends(ClientResourceExhausted, _super);
    function ClientResourceExhausted() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ClientResourceExhausted.status = StatusCode.CLIENT_RESOURCE_EXHAUSTED;
    return ClientResourceExhausted;
}(TransportError));
exports.ClientResourceExhausted = ClientResourceExhausted;
var TRANSPORT_ERROR_CODES = new Map([
    [constants_1.Status.CANCELLED, Cancelled],
    [constants_1.Status.UNAVAILABLE, TransportUnavailable],
    [constants_1.Status.DEADLINE_EXCEEDED, ClientDeadlineExceeded],
    [constants_1.Status.RESOURCE_EXHAUSTED, ClientResourceExhausted]
]);
var MissingOperation = /** @class */ (function (_super) {
    __extends(MissingOperation, _super);
    function MissingOperation() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return MissingOperation;
}(YdbError));
exports.MissingOperation = MissingOperation;
var MissingValue = /** @class */ (function (_super) {
    __extends(MissingValue, _super);
    function MissingValue() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return MissingValue;
}(YdbError));
exports.MissingValue = MissingValue;
var MissingStatus = /** @class */ (function (_super) {
    __extends(MissingStatus, _super);
    function MissingStatus() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return MissingStatus;
}(YdbError));
exports.MissingStatus = MissingStatus;
var TimeoutExpired = /** @class */ (function (_super) {
    __extends(TimeoutExpired, _super);
    function TimeoutExpired() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return TimeoutExpired;
}(YdbError));
exports.TimeoutExpired = TimeoutExpired;
