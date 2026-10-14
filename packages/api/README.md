# @ydbjs/api

The `@ydbjs/api` package provides TypeScript/JavaScript bindings for interacting with YDB services. It includes generated gRPC service definitions and protocol buffer types for various YDB APIs.

## Features

- gRPC service definitions for YDB APIs
- Protocol buffer types for YDB entities
- TypeScript support with type definitions

## Installation

Install the package using npm:

```sh
npm install @ydbjs/api
```

## Usage

### Importing Services

```ts
import { DiscoveryServiceDefinition } from '@ydbjs/api/discovery'
import { CmsServiceDefinition } from '@ydbjs/api/cms'
import { QueryServiceDefinition } from '@ydbjs/api/query'
import { PileState, PileState_State } from '@ydbjs/api/bridge' // bridge / multi-pile (2-DC) clusters
```

### Using with @ydbjs/core

```ts
import { DiscoveryServiceDefinition } from '@ydbjs/api/discovery'
import { Driver } from '@ydbjs/core'

let driver = new Driver('grpc://localhost:2136/local')
await driver.ready()
let client = driver.createClient(DiscoveryServiceDefinition)

client.listEndpoints({ database: driver.database }, (error, response) => {
  driver.close()
  if (error) {
    console.error(error)
    return
  }
  console.log(response)
})
```

Service definitions use native grpc-js `Buffer` serializers and can be passed directly to `makeClientConstructor` from `@grpc/grpc-js`. `ServiceClient` from `@ydbjs/api/client` supplies TypeScript method signatures only; it creates no runtime client or wrapper.

`@ydbjs/api/stream` provides `unaryCall(start, signal)`, `readStream(call, signal)`, and `writeStream(input, call, signal)` for SDK code that uses promises or async iteration. They operate on existing native calls and preserve native errors and metadata. `writeStream` owns request writes and half-close; the caller owns RPC cancellation and must release a blocked input iterator when aborting.

Low-level clients use native `Metadata`, `CallOptions`, interceptors, and `ServiceError` from `@grpc/grpc-js`. The previous nice-grpc Promise/AsyncIterable method signatures, metadata facade, ts-proto definition conversion, and `ClientError` compatibility are not retained.

## Development

### Generating gRPC and Protocol Buffer Files

```sh
npm run generate
```

## License

This project is licensed under the [Apache 2.0 License](../../LICENSE).

## Links

- [YDB Documentation](https://ydb.tech)
- [GitHub Repository](https://github.com/ydb-platform/ydb-js-sdk)
- [Issues](https://github.com/ydb-platform/ydb-js-sdk/issues)
