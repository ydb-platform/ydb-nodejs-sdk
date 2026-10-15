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

Replace the nice-grpc runtime dependency with a small async adapter over grpc-js. Service methods retain Promise results and AsyncIterable request/response streams, with AbortSignal cancellation and native stream backpressure.

Driver.createClient returns the async service client. Use createPinnedClient to await endpoint pin acquisition explicitly. ClientCallOptions accepts native Metadata and grpc-js call options alongside signal, onHeader and onTrailer. Replace addClientMiddleware and CredentialsProvider.middleware with native addClientInterceptor and CredentialsProvider.interceptor. Metadata.get returns an array; server failures retain native ServiceError codes, details and trailers. Query metadata events carry native Metadata.

High-level TopicWriter, TopicReader, query and coordination operations retain their APIs. Custom service definitions use the native grpc-js ServiceDefinition format.
