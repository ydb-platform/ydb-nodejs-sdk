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
exports.TimeoutExpired = exports.MissingStatus = exports.MissingValue = exports.MissingOperation = exports.ClientCancelled = exports.ClientResourceExhausted = exports.ClientDeadlineExceeded = exports.TransportUnavailable = exports.TransportError = exports.ExternalError = exports.SessionBusy = exports.Unsupported = exports.Undetermined = exports.Cancelled = exports.SessionExpired = exports.AlreadyExists = exports.NotFound = exports.PreconditionFailed = exports.Timeout = exports.BadSession = exports.GenericError = exports.SchemeError = exports.Overloaded = exports.Unavailable = exports.Aborted = exports.InternalError = exports.Unauthorized = exports.BadRequest = exports.SessionPoolEmpty = exports.Unauthenticated = exports.StatusCodeUnspecified = exports.YdbError = exports.StatusCode = void 0;
var constants_1 = require("@grpc/grpc-js/build/src/constants");
var symbols_1 = require("./retries/symbols");
var TRANSPORT_STATUSES_FIRST = 401000;
var CLIENT_STATUSES_FIRST = 402000;
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
    StatusCode[StatusCode["EXTERNAL_ERROR"] = 400200] = "EXTERNAL_ERROR";
    // Client statuses
    /** Cannot connect or unrecoverable network error. (map from gRPC UNAVAILABLE) */
    StatusCode[StatusCode["TRANSPORT_UNAVAILABLE"] = 401010] = "TRANSPORT_UNAVAILABLE";
    // Theoritically should begin with `TRANSPORT_`, but renamed due to compatibility
    StatusCode[StatusCode["CLIENT_RESOURCE_EXHAUSTED"] = 401020] = "CLIENT_RESOURCE_EXHAUSTED";
    StatusCode[StatusCode["CLIENT_DEADLINE_EXCEEDED"] = 401030] = "CLIENT_DEADLINE_EXCEEDED";
    StatusCode[StatusCode["CLIENT_CANCELED"] = 401034] = "CLIENT_CANCELED";
    StatusCode[StatusCode["UNAUTHENTICATED"] = 402030] = "UNAUTHENTICATED";
    StatusCode[StatusCode["SESSION_POOL_EMPTY"] = 402040] = "SESSION_POOL_EMPTY";
})(StatusCode || (exports.StatusCode = StatusCode = {}));
function retryPolicy(backoff, deleteSession, idempotent, nonIdempotent) {
    if (nonIdempotent && !idempotent)
        throw new Error('Senseless');
    return { backoff: backoff, deleteSession: deleteSession, idempotent: idempotent, nonIdempotent: nonIdempotent };
}
var YdbError = /** @class */ (function (_super) {
    __extends(YdbError, _super);
    function YdbError(message, issues) {
        if (issues === void 0) { issues = []; }
        var _this = _super.call(this, message) || this;
        _this.issues = issues;
        return _this;
    }
    YdbError.formatIssues = function (issues) {
        return issues ? JSON.stringify(issues, null, 2) : '';
    };
    /**
     * If YDB returns an error YdbError is thrown.
     * @param operation
     */
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
    /**
     * Issues from Ydb are returned as a tree with nested issues.  Returns the list of issues as a flat array.
     * The nested issues follow their parents.
     */
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
var StatusCodeUnspecified = /** @class */ (function (_super) {
    __extends(StatusCodeUnspecified, _super);
    function StatusCodeUnspecified() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_a] = retryPolicy(0 /* Backoff.No */, false, false, false);
        return _this;
    }
    var _a;
    _a = symbols_1.RetryPolicySymbol;
    StatusCodeUnspecified.status = StatusCode.STATUS_CODE_UNSPECIFIED;
    return StatusCodeUnspecified;
}(YdbError));
exports.StatusCodeUnspecified = StatusCodeUnspecified;
var Unauthenticated = /** @class */ (function (_super) {
    __extends(Unauthenticated, _super);
    function Unauthenticated() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_b] = retryPolicy(0 /* Backoff.No */, true, false, false);
        return _this;
    }
    var _b;
    _b = symbols_1.RetryPolicySymbol;
    Unauthenticated.status = StatusCode.UNAUTHENTICATED;
    return Unauthenticated;
}(YdbError));
exports.Unauthenticated = Unauthenticated;
var SessionPoolEmpty = /** @class */ (function (_super) {
    __extends(SessionPoolEmpty, _super);
    function SessionPoolEmpty() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_c] = retryPolicy(1 /* Backoff.Fast */, false, true, true); // TODO: not found go impl yet
        return _this;
    }
    var _c;
    _c = symbols_1.RetryPolicySymbol;
    SessionPoolEmpty.status = StatusCode.SESSION_POOL_EMPTY;
    return SessionPoolEmpty;
}(YdbError));
exports.SessionPoolEmpty = SessionPoolEmpty;
var BadRequest = /** @class */ (function (_super) {
    __extends(BadRequest, _super);
    function BadRequest() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_d] = retryPolicy(0 /* Backoff.No */, false, false, false);
        return _this;
    }
    var _d;
    _d = symbols_1.RetryPolicySymbol;
    BadRequest.status = StatusCode.BAD_REQUEST;
    return BadRequest;
}(YdbError));
exports.BadRequest = BadRequest;
var Unauthorized = /** @class */ (function (_super) {
    __extends(Unauthorized, _super);
    function Unauthorized() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_e] = retryPolicy(0 /* Backoff.No */, false, false, false);
        return _this;
    }
    var _e;
    _e = symbols_1.RetryPolicySymbol;
    Unauthorized.status = StatusCode.UNAUTHORIZED;
    return Unauthorized;
}(YdbError));
exports.Unauthorized = Unauthorized;
var InternalError = /** @class */ (function (_super) {
    __extends(InternalError, _super);
    function InternalError() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_f] = retryPolicy(0 /* Backoff.No */, false, false, false);
        return _this;
    }
    var _f;
    _f = symbols_1.RetryPolicySymbol;
    InternalError.status = StatusCode.INTERNAL_ERROR;
    return InternalError;
}(YdbError));
exports.InternalError = InternalError;
var Aborted = /** @class */ (function (_super) {
    __extends(Aborted, _super);
    function Aborted() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_g] = retryPolicy(1 /* Backoff.Fast */, false, true, true);
        return _this;
    }
    var _g;
    _g = symbols_1.RetryPolicySymbol;
    Aborted.status = StatusCode.ABORTED;
    return Aborted;
}(YdbError));
exports.Aborted = Aborted;
var Unavailable = /** @class */ (function (_super) {
    __extends(Unavailable, _super);
    function Unavailable() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        // TODO: Requires extra logic - see https://github.com/ydb-platform/ydb-go-sdk/blob/e1ba79620427a66c1564a52abe7e1ff10787d442/retry/errors_data_test.go#L197
        _this[_h] = retryPolicy(1 /* Backoff.Fast */, false, true, false);
        return _this;
    }
    var _h;
    _h = symbols_1.RetryPolicySymbol;
    Unavailable.status = StatusCode.UNAVAILABLE;
    return Unavailable;
}(YdbError));
exports.Unavailable = Unavailable;
var Overloaded = /** @class */ (function (_super) {
    __extends(Overloaded, _super);
    function Overloaded() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_j] = retryPolicy(2 /* Backoff.Slow */, false, true, true);
        return _this;
    }
    var _j;
    _j = symbols_1.RetryPolicySymbol;
    Overloaded.status = StatusCode.OVERLOADED;
    return Overloaded;
}(YdbError));
exports.Overloaded = Overloaded;
var SchemeError = /** @class */ (function (_super) {
    __extends(SchemeError, _super);
    function SchemeError() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_k] = retryPolicy(0 /* Backoff.No */, false, false, false);
        return _this;
    }
    var _k;
    _k = symbols_1.RetryPolicySymbol;
    SchemeError.status = StatusCode.SCHEME_ERROR;
    return SchemeError;
}(YdbError));
exports.SchemeError = SchemeError;
var GenericError = /** @class */ (function (_super) {
    __extends(GenericError, _super);
    function GenericError() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_l] = retryPolicy(0 /* Backoff.No */, false, false, false);
        return _this;
    }
    var _l;
    _l = symbols_1.RetryPolicySymbol;
    GenericError.status = StatusCode.GENERIC_ERROR;
    return GenericError;
}(YdbError));
exports.GenericError = GenericError;
var BadSession = /** @class */ (function (_super) {
    __extends(BadSession, _super);
    function BadSession() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_m] = retryPolicy(0 /* Backoff.No */, true, true, true);
        return _this;
    }
    var _m;
    _m = symbols_1.RetryPolicySymbol;
    BadSession.status = StatusCode.BAD_SESSION;
    return BadSession;
}(YdbError));
exports.BadSession = BadSession;
var Timeout = /** @class */ (function (_super) {
    __extends(Timeout, _super);
    function Timeout() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_o] = retryPolicy(0 /* Backoff.No */, false, false, false);
        return _this;
    }
    var _o;
    _o = symbols_1.RetryPolicySymbol;
    Timeout.status = StatusCode.TIMEOUT;
    return Timeout;
}(YdbError));
exports.Timeout = Timeout;
var PreconditionFailed = /** @class */ (function (_super) {
    __extends(PreconditionFailed, _super);
    function PreconditionFailed() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_p] = retryPolicy(0 /* Backoff.No */, false, false, false);
        return _this;
    }
    var _p;
    _p = symbols_1.RetryPolicySymbol;
    PreconditionFailed.status = StatusCode.PRECONDITION_FAILED;
    return PreconditionFailed;
}(YdbError));
exports.PreconditionFailed = PreconditionFailed;
var NotFound = /** @class */ (function (_super) {
    __extends(NotFound, _super);
    function NotFound() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_q] = retryPolicy(0 /* Backoff.No */, false, false, false);
        return _this;
    }
    var _q;
    _q = symbols_1.RetryPolicySymbol;
    NotFound.status = StatusCode.NOT_FOUND;
    return NotFound;
}(YdbError));
exports.NotFound = NotFound;
var AlreadyExists = /** @class */ (function (_super) {
    __extends(AlreadyExists, _super);
    function AlreadyExists() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_r] = retryPolicy(0 /* Backoff.No */, false, false, false);
        return _this;
    }
    var _r;
    _r = symbols_1.RetryPolicySymbol;
    AlreadyExists.status = StatusCode.ALREADY_EXISTS;
    return AlreadyExists;
}(YdbError));
exports.AlreadyExists = AlreadyExists;
var SessionExpired = /** @class */ (function (_super) {
    __extends(SessionExpired, _super);
    function SessionExpired() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_s] = retryPolicy(0 /* Backoff.No */, true, false, false);
        return _this;
    }
    var _s;
    _s = symbols_1.RetryPolicySymbol;
    SessionExpired.status = StatusCode.SESSION_EXPIRED;
    return SessionExpired;
}(YdbError));
exports.SessionExpired = SessionExpired;
var Cancelled = /** @class */ (function (_super) {
    __extends(Cancelled, _super);
    function Cancelled() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_t] = retryPolicy(1 /* Backoff.Fast */, false, false, false);
        return _this;
    }
    var _t;
    _t = symbols_1.RetryPolicySymbol;
    Cancelled.status = StatusCode.CANCELLED;
    return Cancelled;
}(YdbError));
exports.Cancelled = Cancelled;
var Undetermined = /** @class */ (function (_super) {
    __extends(Undetermined, _super);
    function Undetermined() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_u] = retryPolicy(1 /* Backoff.Fast */, false, true, false);
        return _this;
    }
    var _u;
    _u = symbols_1.RetryPolicySymbol;
    Undetermined.status = StatusCode.UNDETERMINED;
    return Undetermined;
}(YdbError));
exports.Undetermined = Undetermined;
var Unsupported = /** @class */ (function (_super) {
    __extends(Unsupported, _super);
    function Unsupported() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_v] = retryPolicy(1 /* Backoff.Fast */, true, true, true);
        return _this;
    }
    var _v;
    _v = symbols_1.RetryPolicySymbol;
    Unsupported.status = StatusCode.UNSUPPORTED;
    return Unsupported;
}(YdbError));
exports.Unsupported = Unsupported;
var SessionBusy = /** @class */ (function (_super) {
    __extends(SessionBusy, _super);
    function SessionBusy() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_w] = retryPolicy(1 /* Backoff.Fast */, true, true, true);
        return _this;
    }
    var _w;
    _w = symbols_1.RetryPolicySymbol;
    SessionBusy.status = StatusCode.SESSION_BUSY;
    return SessionBusy;
}(YdbError));
exports.SessionBusy = SessionBusy;
var ExternalError = /** @class */ (function (_super) {
    __extends(ExternalError, _super);
    function ExternalError() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_x] = retryPolicy(0 /* Backoff.No */, false, false, true);
        return _this;
    }
    var _x;
    _x = symbols_1.RetryPolicySymbol;
    ExternalError.status = StatusCode.EXTERNAL_ERROR;
    return ExternalError;
}(YdbError));
exports.ExternalError = ExternalError;
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
    [StatusCode.EXTERNAL_ERROR, ExternalError],
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
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_y] = retryPolicy(1 /* Backoff.Fast */, true, true, false);
        return _this;
    }
    var _y;
    _y = symbols_1.RetryPolicySymbol;
    TransportUnavailable.status = StatusCode.TRANSPORT_UNAVAILABLE;
    return TransportUnavailable;
}(TransportError));
exports.TransportUnavailable = TransportUnavailable;
var ClientDeadlineExceeded = /** @class */ (function (_super) {
    __extends(ClientDeadlineExceeded, _super);
    function ClientDeadlineExceeded() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_z] = retryPolicy(0 /* Backoff.No */, false, false, false);
        return _this;
    }
    var _z;
    _z = symbols_1.RetryPolicySymbol;
    ClientDeadlineExceeded.status = StatusCode.CLIENT_DEADLINE_EXCEEDED;
    return ClientDeadlineExceeded;
}(TransportError));
exports.ClientDeadlineExceeded = ClientDeadlineExceeded;
var ClientResourceExhausted = /** @class */ (function (_super) {
    __extends(ClientResourceExhausted, _super);
    function ClientResourceExhausted() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this[_0] = retryPolicy(2 /* Backoff.Slow */, false, true, true);
        return _this;
    }
    var _0;
    _0 = symbols_1.RetryPolicySymbol;
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
var ClientCancelled = /** @class */ (function (_super) {
    __extends(ClientCancelled, _super);
    function ClientCancelled(cause) {
        var _this = _super.call(this, "Operation cancelled. Cause: ".concat(cause.message)) || this;
        _this.cause = cause;
        _this[_1] = retryPolicy(0 /* Backoff.No */, false, false, false);
        return _this;
    }
    var _1;
    _1 = symbols_1.RetryPolicySymbol;
    ClientCancelled.status = StatusCode.CLIENT_CANCELED;
    return ClientCancelled;
}(YdbError));
exports.ClientCancelled = ClientCancelled;
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
}(YdbError)); // TODO: What's the diff with ClientCancelled
exports.TimeoutExpired = TimeoutExpired;
