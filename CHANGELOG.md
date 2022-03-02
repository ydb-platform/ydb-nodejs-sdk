# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [2.9.2](https://www.github.com/ydb-platform/ydb-nodejs-sdk/compare/v2.9.1...v2.9.2) (2022-02-09)


### Bug Fixes

* **MetadataAuthService:** remove ssl defaults for grpc scheme ([40523f7](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/40523f796f281bbba6de23c6c86013d1bb794d0b))

### [2.9.1](https://www.github.com/ydb-platform/ydb-nodejs-sdk/compare/v2.9.0...v2.9.1) (2022-01-21)


### Bug Fixes

* **package.json:** move pino-pretty to dependencies ([bf739d2](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/bf739d20f5c66fb3ce4381a31e1a410fa9e22b2d))

## [2.9.0](https://www.github.com/ydb-platform/ydb-nodejs-sdk/compare/v2.8.1...v2.9.0) (2021-12-29)


### Features

* **describeTable:** add new function signature ([4e2106d](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/4e2106d4eb23ff3bd1ca777222bfd53ad85fa6ed))
* **executeQuery:** add collectStats parameter ([bae40fa](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/bae40fa507bd064763178cfb4954b936da1c7b76))


### Bug Fixes

* **examples:** remove package-lock.json from examples repo ([b80de4e](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/b80de4eb9e99458067b525984d5d041f1bef73b4))

### [2.8.1](https://github.com/ydb-platform/ydb-nodejs-sdk/compare/v2.8.0...v2.8.1) (2021-12-14)

## [2.8.0](https://github.com/ydb-platform/ydb-nodejs-sdk/compare/v2.7.0...v2.8.0) (2021-12-09)


### Features

* **tableClient:** implement bulkUpsert method ([a4b63f6](https://github.com/ydb-platform/ydb-nodejs-sdk/commit/a4b63f6b7fabde3f1411b95575b6cbf7eac6c371))

## [2.7.0](https://github.com/ydb-platform/ydb-nodejs-sdk/compare/v2.6.3...v2.7.0) (2021-12-03)


### Features

* **tableClient:** implement streamReadTable call ([1809215](https://github.com/ydb-platform/ydb-nodejs-sdk/commit/1809215c8317f79a64f476d42236d337f1b334c5))

### [2.6.3](https://github.com/ydb-platform/ydb-nodejs-sdk/compare/v2.6.2...v2.6.3) (2021-12-02)


### Bug Fixes

* **ssl:** no more SSL connection attempts for grpc:// endpoints ([7c517aa](https://github.com/ydb-platform/ydb-nodejs-sdk/commit/7c517aae5c8f9d069de16fec714e3581dfe8f922))

### 2.6.0
* YDB definitions bundle and generating bundle from protobuf files have been moved to ydb-sdk-proto
  dependency package

### 2.5.0
* All authentication helper classes are now exported from top-level and ready to be used in client
  code.
* Added authentication code snippets to /examples

### 2.4.0
* Support new unified environment variables: YDB_ACCESS_TOKEN_CREDENTIALS,
  YDB_ANONYMOUS_CREDENTIALS, YDB_METADATA_CREDENTIALS, YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS
* Deprecate old credentials environment variables: YDB_TOKEN, SA_ID, SA_PRIVATE_KEY_FILE,
  SA_ACCESS_KEY_ID, SA_JSON_FILE
* Put back embedded certificate file, now certificates for YDB dedicated instances are
  concatenated with system certificates, which should allow to use embedded certificate
  for both dedicated and serverless databases.

### 2.3.0
* Provide `Primitive` helper class for easy creation of primitive values, see how it's used in
  in /scan-query example.

### 2.2.0
* Support `streamExecuteScanQuery()` method in `tableClient`
* Provide means to alter default snake_case - camelCase field names conversion when moving data
  between YDB and JS side, via `@withTypeOptions` decorator (with an example)

### 2.1.0
* Allow passing gRPC [client options](https://grpc.github.io/grpc/core/group__grpc__arg__keys.html)
  under `clientOptions` key to `Driver` constructor. This enables changing different
  gRPC settings in `tableClient` and `schemaClient` calls.

### 2.0.0
* BREAKING CHANGE: StorageSettings class exported at toplevel has changed its structure:
  the only public `storageKind` field has been renamed to `media`, type is the same. This
  was done due to underlying protobufs change, where StorageSettings message has been
  completely changed and the old StorageSettings is now known as StoragePool (with `media` field).
* Added JSON_DOCUMENT YDB primitive support.
* ExecuteStreamQuery -> StreamExecuteScanQuery in protobufs
* and many other changes in protobufs.

### 1.10.0
* Add `alterTable` method to Session class
* Put compiled protobufs to a separate 'ydb-sdk' namespace

### 1.9.0
* Pass 'x-ydb-sdk-build-info' header with library name/version to every GRPC request.
