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

let response = await client.listEndpoints({ database: driver.database })
console.log(response)
driver.close()
```

### Using the standalone transport

```ts
import { Client, createServiceClient } from '@ydbjs/grpc'
import { DiscoveryServiceDefinition } from '@ydbjs/api/discovery'

using transport = new Client('http://localhost:2136')
let client = createServiceClient(DiscoveryServiceDefinition, transport)
let response = await client.listEndpoints(
  { database: '/local' },
  {
    metadata: { 'x-ydb-database': '/local' },
    signal: AbortSignal.timeout(5000),
  }
)
```

Unary and client-streaming methods return `Promise<Response>`. Server-streaming and bidirectional methods return `AsyncIterable<Response>`. The standalone transport connects to one authority; use `Driver` for YDB discovery, authentication, and node selection. See [`@ydbjs/grpc`](../grpc/README.md) for cancellation, metadata, and connection options.

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
