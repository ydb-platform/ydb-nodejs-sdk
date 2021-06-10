# Changelog

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
