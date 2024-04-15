import {Context} from "../../context/Context";

static enum Backoff{
    No,
    Fast,
    Slow,
}

const testCancel = new Error("Cancel");
const testTimeout = new Error("Timeout");

const errors = [
    {
        // retryer given unknown error - we will not operationStatus and will close session
        err:           fmt.Errorf("unknown error"),
        backoff:       Backoff.No,
        deleteSession: false,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        // golang context deadline exceeded
        err:           context.DeadlineExceeded,
        backoff:       Backoff.No,
        deleteSession: false,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        // golang context canceled
        err:           context.Canceled,
        backoff:       Backoff.No,
        deleteSession: false,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err: xerrors.Transport(
            //nolint:staticcheck
            // ignore SA1019
            //nolint:nolintlint
            grpc.ErrClientConnClosing,
        ),
        backoff:       Backoff.Fast,
        deleteSession: true,
        canRetry: {
            idempotent:    true,
            nonIdempotent: false,
        },
    },
    {
        err:           xerrors.Transport(grpcStatus.Error(grpcCodes.Canceled, "")),
        backoff:       Backoff.Fast,
        deleteSession: true,
        canRetry: {
            idempotent:    true, // if client context is not done
            nonIdempotent: false,
        },
    },
    {
        err:           xerrors.Transport(grpcStatus.Error(grpcCodes.Unknown, "")),
        backoff:       Backoff.No,
        deleteSession: true,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err:           xerrors.Transport(grpcStatus.Error(grpcCodes.InvalidArgument, "")),
        backoff:       Backoff.No,
        deleteSession: true,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err:           xerrors.Transport(grpcStatus.Error(grpcCodes.DeadlineExceeded, "")),
        backoff:       Backoff.Fast,
        deleteSession: true,
        canRetry: {
            idempotent:    true, // if client context is not done
            nonIdempotent: false,
        },
    },
    {
        err:           xerrors.Transport(grpcStatus.Error(grpcCodes.NotFound, "")),
        backoff:       Backoff.No,
        deleteSession: true,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err:           xerrors.Transport(grpcStatus.Error(grpcCodes.AlreadyExists, "")),
        backoff:       Backoff.No,
        deleteSession: true,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err:           xerrors.Transport(grpcStatus.Error(grpcCodes.PermissionDenied, "")),
        backoff:       Backoff.No,
        deleteSession: true,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err:           xerrors.Transport(grpcStatus.Error(grpcCodes.ResourceExhausted, "")),
        backoff:       backoff.TypeSlow,
        deleteSession: false,
        canRetry: {
            idempotent:    true,
            nonIdempotent: true,
        },
    },
    {
        err:           xerrors.Transport(grpcStatus.Error(grpcCodes.FailedPrecondition, "")),
        backoff:       Backoff.No,
        deleteSession: true,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err:           xerrors.Transport(grpcStatus.Error(grpcCodes.Aborted, "")),
        backoff:       Backoff.No,
        deleteSession: true,
        canRetry: {
            idempotent:    true,
            nonIdempotent: true,
        },
    },
    {
        err:           xerrors.Transport(grpcStatus.Error(grpcCodes.OutOfRange, "")),
        backoff:       Backoff.No,
        deleteSession: false,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err:           xerrors.Transport(grpcStatus.Error(grpcCodes.Unimplemented, "")),
        backoff:       Backoff.No,
        deleteSession: true,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err:           xerrors.Transport(grpcStatus.Error(grpcCodes.Internal, "")),
        backoff:       Backoff.Fast,
        deleteSession: true,
        canRetry: {
            idempotent:    true,
            nonIdempotent: false,
        },
    },
    {
        err:           xerrors.Transport(grpcStatus.Error(grpcCodes.Unavailable, "")),
        backoff:       Backoff.Fast,
        deleteSession: true,
        canRetry: {
            idempotent:    true,
            nonIdempotent: false,
        },
    },
    {
        err:           xerrors.Transport(grpcStatus.Error(grpcCodes.DataLoss, "")),
        backoff:       Backoff.No,
        deleteSession: true,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err:           xerrors.Transport(grpcStatus.Error(grpcCodes.Unauthenticated, "")),
        backoff:       Backoff.No,
        deleteSession: true,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_STATUS_CODE_UNSPECIFIED),
        ),
        backoff:       Backoff.No,
        deleteSession: false,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_BAD_REQUEST),
        ),
        backoff:       Backoff.No,
        deleteSession: false,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_UNAUTHORIZED),
        ),
        backoff:       Backoff.No,
        deleteSession: false,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_INTERNAL_ERROR),
        ),
        backoff:       Backoff.No,
        deleteSession: false,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_ABORTED),
        ),
        backoff:       Backoff.Fast,
        deleteSession: false,
        canRetry: {
            idempotent:    true,
            nonIdempotent: true,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_UNAVAILABLE),
        ),
        backoff:       Backoff.Fast,
        deleteSession: false,
        canRetry: {
            idempotent:    true,
            nonIdempotent: true,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_OVERLOADED),
        ),
        backoff:       backoff.TypeSlow,
        deleteSession: false,
        canRetry: {
            idempotent:    true,
            nonIdempotent: true,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_SCHEME_ERROR),
        ),
        backoff:       Backoff.No,
        deleteSession: false,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_GENERIC_ERROR),
        ),
        backoff:       Backoff.No,
        deleteSession: false,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_TIMEOUT),
        ),
        backoff:       Backoff.No,
        deleteSession: false,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_BAD_SESSION),
        ),
        backoff:       Backoff.No,
        deleteSession: true,
        canRetry: {
            idempotent:    true,
            nonIdempotent: true,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_PRECONDITION_FAILED),
        ),
        backoff:       Backoff.No,
        deleteSession: false,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_ALREADY_EXISTS),
        ),
        backoff:       Backoff.No,
        deleteSession: false,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_NOT_FOUND),
        ),
        backoff:       Backoff.No,
        deleteSession: false,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_SESSION_EXPIRED),
        ),
        backoff:       Backoff.No,
        deleteSession: true,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_CANCELLED),
        ),
        backoff:       Backoff.Fast,
        deleteSession: false,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_UNDETERMINED),
        ),
        backoff:       Backoff.Fast,
        deleteSession: false,
        canRetry: {
            idempotent:    true,
            nonIdempotent: false,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_UNSUPPORTED),
        ),
        backoff:       Backoff.No,
        deleteSession: false,
        canRetry: {
            idempotent:    false,
            nonIdempotent: false,
        },
    },
    {
        err: xerrors.Operation(
            xerrors.WithStatusCode(Ydb.StatusIds_SESSION_BUSY),
        ),
        backoff:       Backoff.Fast,
        deleteSession: true,
        canRetry: {
            idempotent:    true,
            nonIdempotent: true,
        },
    },
}
