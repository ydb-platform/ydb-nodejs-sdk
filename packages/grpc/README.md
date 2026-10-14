# @ydbjs/grpc

Typed Promise and AsyncIterable clients over `@grpc/grpc-js`, used by the YDB SDK.

```ts
import { Channel, ChannelCredentials, createClient } from '@ydbjs/grpc'
import { DiscoveryServiceDefinition } from '@ydbjs/api/discovery'

let channel = new Channel('localhost:2136', ChannelCredentials.createInsecure(), {})
let client = createClient(DiscoveryServiceDefinition, channel)

try {
  let result = await client.listEndpoints({ database: '/local' })
  console.log(result)
} finally {
  channel.close()
}
```

Unary and client-streaming methods return a Promise. Server-streaming and bidirectional methods return an AsyncIterable. Client-streaming and bidirectional methods accept an AsyncIterable of requests. Finishing the request iterable half-closes the RPC; responses can still arrive. Leaving a response loop cancels that RPC, not the shared channel.

Call options accept `signal`, `metadata`, `onHeader`, and `onTrailer`. `Metadata()` supports text and binary metadata; `ClientError` exposes `path`, `code`, and `details`. Import `Status` for gRPC status codes.

`createClient(service, channel, defaults, middleware)` accepts an optional async-generator middleware. Defaults are keyed by method name or `'*'`; per-call options override defaults. `composeClientMiddleware(first, second)` runs `second` on the outside, preserving the existing SDK middleware ordering.

Service definitions from `@ydbjs/api`, grpc-js, and ts-proto are supported. Existing middleware and metadata objects are structurally compatible; existing nice-grpc `ClientError` checks remain compatible. Import these types from `@ydbjs/grpc` for new code.

Retry, discovery, authentication, and reconnection belong to the SDK packages that use this adapter.
