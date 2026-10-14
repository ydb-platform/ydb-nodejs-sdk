---
'@ydbjs/api': major
'@ydbjs/auth': major
'@ydbjs/core': major
'@ydbjs/coordination': major
'@ydbjs/query': major
'@ydbjs/retry': major
'@ydbjs/telemetry': major
'@ydbjs/topic': major
'@ydbjs/error': minor
---

Use native grpc-js clients, streams, Metadata, CallOptions, interceptors and ServiceError throughout the SDK. Remove the nice-grpc runtime dependency and its client facade.

Driver.createClient now returns a native grpc-js client: unary methods take callbacks and streaming methods return native streams. Use createPinnedClient to await endpoint pin acquisition explicitly. Replace addClientMiddleware and CredentialsProvider.middleware with native addClientInterceptor and CredentialsProvider.interceptor. Metadata.get returns an array; handle native ServiceError codes instead of nice-grpc ClientError. Query metadata events carry native Metadata.

High-level TopicWriter, TopicReader, query and coordination operations retain their APIs. Native stream helpers provide AbortSignal cancellation, async reading and request backpressure without a replacement client framework.
