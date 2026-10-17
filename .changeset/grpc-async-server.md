---
'@ydbjs/grpc': minor
---

Add a dependency-free HTTP/2 gRPC Server with typed Promise and AsyncIterable handlers, plain metadata, cancellation, deadlines, TLS, and bounded response writes. Reuse generated service definitions and release servers with `using`, which cancels active calls through `destroy()`. Explicitly `await server.close()` for graceful shutdown: reject new calls, drain accepted RPCs, and release the remaining resources.
