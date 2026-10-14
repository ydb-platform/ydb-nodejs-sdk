---
'@ydbjs/grpc': minor
'@ydbjs/api': patch
'@ydbjs/auth': patch
'@ydbjs/core': patch
'@ydbjs/coordination': patch
'@ydbjs/query': patch
'@ydbjs/retry': patch
'@ydbjs/telemetry': patch
'@ydbjs/topic': patch
---

Replace the nice-grpc runtime dependency with @ydbjs/grpc, a direct grpc-js adapter. Preserve RPC streaming, cancellation, metadata, middleware, and error contracts. Avoid copying newly serialized YDB request buffers while retaining protective copies for custom serializers.
