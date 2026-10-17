---
'@ydbjs/grpc': minor
---

Add a dependency-free HTTP/2 gRPC Server with typed Promise and AsyncIterable handlers, plain metadata, cancellation, deadlines, TLS, and bounded response writes. Reuse generated service definitions and gracefully close servers with `await using`: reject new calls, drain accepted RPCs, and release the remaining resources. Use `destroy()` for immediate cancellation.
