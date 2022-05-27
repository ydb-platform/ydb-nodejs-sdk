# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [3.3.2](https://github.com/ydb-platform/ydb-nodejs-sdk/compare/v3.3.1...v3.3.2) (2022-05-27)


### Bug Fixes

* correctly access internal certs from compiled sources ([f7e520d](https://github.com/ydb-platform/ydb-nodejs-sdk/commit/f7e520dbc7ef1fd31cb30684a66b3daa22792f03)), closes [#163](https://github.com/ydb-platform/ydb-nodejs-sdk/issues/163)

### [3.3.1](https://github.com/ydb-platform/ydb-nodejs-sdk/compare/v3.3.0...v3.3.1) (2022-05-26)


### Bug Fixes

* correctly access package.json ([5bba0d9](https://github.com/ydb-platform/ydb-nodejs-sdk/commit/5bba0d9847562a56cec6b5f0648d7382e1edbeed))

## [3.3.0](https://github.com/ydb-platform/ydb-nodejs-sdk/compare/v3.2.0...v3.3.0) (2022-05-20)


### Features

* add esnext target to support using library via ES modules ([09deade](https://github.com/ydb-platform/ydb-nodejs-sdk/commit/09deade911096c1ea86d437add6853c0e540ee38)), closes [#145](https://github.com/ydb-platform/ydb-nodejs-sdk/issues/145)

## [3.2.0](https://github.com/ydb-platform/ydb-nodejs-sdk/compare/v3.1.1...v3.2.0) (2022-05-20)


### Features

* process 'session-close' server hint from trailing metadata ([d9c15ba](https://github.com/ydb-platform/ydb-nodejs-sdk/commit/d9c15bacaa1907f6f206ba1f2ca63bbc4da16c26))


### Bug Fixes

* acquire new session once free slot becomes available in pool ([4500226](https://github.com/ydb-platform/ydb-nodejs-sdk/commit/4500226c058707aab8f5f78f0a8ba9d6da6aad4d))

### [3.1.1](https://www.github.com/ydb-platform/ydb-nodejs-sdk/compare/v3.1.0...v3.1.1) (2022-05-13)


### Bug Fixes

* add `muteNonExistingTableErrors` to `DropTableSettings` class ([c2f6037](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/c2f60374862f7e0307521254c58e543fb6c12a30)), closes [#141](https://www.github.com/ydb-platform/ydb-nodejs-sdk/issues/141)

## [3.1.0](https://www.github.com/ydb-platform/ydb-nodejs-sdk/compare/v3.0.0...v3.1.0) (2022-05-12)


### Features

* use newer @yandex-cloud/nodejs-sdk package based on grpc-js ([2d37272](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/2d372729a9a89a96e4342787b86448dab4762be7)), closes [#146](https://www.github.com/ydb-platform/ydb-nodejs-sdk/issues/146)

## [3.0.0](https://www.github.com/ydb-platform/ydb-nodejs-sdk/compare/v2.9.2...v3.0.0) (2022-03-02)


### ⚠ BREAKING CHANGES

* all signatures of SchemeClient's methods now have optional `settings` parameter instead of `operationParams`.
    - Before: `makeDirectory(path, operationParams?)`
      After: `makeDirectory(path, {operationParams: ...}?)`
    - Before: `removeDirectory(path, operationParams?)`
      After: `removeDirectory(path, {operationParams: ...}?)`
    - Before: `listDirectory(path, operationParams?)`
      After: `listDirectory(path, {operationParams: ...}?)`
    - Before: `describePath(path, operationParams?)`
      After: `describePath(path, {operationParams: ...}?)`
    - Before: `modifyPermissions(path, ..., ..., operationParams?)`
      After: `modifyPermissions(path, ..., ..., {operationParams: ...}?)`
* TypedData fields have identity conversion to YDB column names instead of camelCase to snake_case. Use `@withTypeOptions({namesConversion:snakeToCamelCaseConversion})` for backward compatibility.
* several types have changed their representation, namely
    - struct value is present as object instead of array
    - decimal value is present as string instead of bigint
      (it wasn't working for float values before)
    - fix uuid and tz-date types conversion (it wasn't working before)
* signatures of most methods in Session are changed:
    - executeQuery
      Before: `(query, params, txControl, operationParams?, settings?, collectStats?)`
      After: `(query, params, txControl, settings?)`
    - describeTable
      Before: `(tablePath: string, operationParams?)|(tablePath, describeTableParams?)`
      After: `(tablePath, settings?)`
    - commitTransaction
      Before: `(txControl, operationParams?)`
      After: `(txControl, settings?)` (and `collectStats` support)
    - createTable, alterTable, dropTable, beginTransaction, rollbackTransaction, prepareQuery,
      bulkUpsert
      Before: `(<required params>, operationParams?)`
      After: `(<required params>, settings?)`
* `tablePath` in `bulkUpsert` and `readTable` methods must be without database prefix
* Primitive class is renamed to `TypedValues`
* signatures of Driver, getCredentialsFromEnv and *AuthService classes are changed:
    - Driver:
      Before: `new Driver(entryPoint, dbName, authService, ...)`
      After: `new Driver({connectionString: "...", authService: ..., ...})`
      or `new Driver({endpoint: "...", database: "...", authService: ..., ...})`
    - *AuthService - `database` and `sslCredentials` are no longer needed in *AuthService constructors
      (ssl credentials option is now initialized in the driver if it's necessary)
      Before: `const authService = new MetadataAuthService(dbName, sslCredentials);`
      After: `const authService = new MetadataAuthService();`
    - getCredentialsFromEnv:
      Before: `const authService = getCredentialsFromEnv(endpoint, database, logger);`
      After: `const authService = getCredentialsFromEnv();` (logger is optional)
* old environment variables are no longer supported. Use YDB_ACCESS_TOKEN_CREDENTIALS instead of YDB_TOKEN, YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS instead of SA_ID, SA_PRIVATE_KEY_FILE, SA_ACCESS_KEY_ID and SA_JSON_FILE.

### Features

* add more methods and fields to type helper classes ([82f26ea](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/82f26eaaad902ca832cbfece2e85536642c4f53b))
* implement `Types` and `TypedValues` helper classes ([029db0e](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/029db0ee5e0996a9e73e19dcd5a5fb846b3d6332))
* implement new type conversions and fix existing type conversions ([0edbcdd](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/0edbcdd09997e7644825c6bd3b015549c5356211))
* reorganize Driver and credentials to simplify SDK usage ([6526378](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/6526378c501addd6a8ab75f9a6fd8f172fc79c26))
* replace grpc with @grpc/grpc-js ([1bd8d06](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/1bd8d06f75c68eed1ec8c855ecab0d0b4bfe7bc4))


### Bug Fixes

* don't use database in `tablePath` for `bulkUpsert` and `readTable` methods ([d416d59](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/d416d59e44a34088d2909bf28d9c3b8535ff2d59))
* error message in test-utils ([af39fd1](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/af39fd1178d22aa8fc558d6a4ef6f80d53acd3a5))
* little fixes in examples ([9c19b95](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/9c19b95dd541705673844aaf960b36c67e2b7b48))


### Miscellaneous

* drop support of old environment variables ([963819a](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/963819af9209a45749f5118077f1da4bdb390fa6))
* reorganize signature of SchemeClient's methods ([734d57a](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/734d57a2dd7c655cf727b96df415212504339cf8))
* reorganize signatures of Session's methods ([431f149](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/431f1491bf880f3ba9541d9455d8dd2f2b7849e6))
* use identity names conversion in TypedData ([275598a](https://www.github.com/ydb-platform/ydb-nodejs-sdk/commit/275598aa444e1e977386a3dadd02bbc9ba01f38e))

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
