If test with [CREATE TABLE](https://ydb.tech/docs/en/yql/reference/syntax/create_table) returns
an error, first make sure last build of YDB image is in use.

`ghcr.io/ydb-platform/local-ydb:nightly`

If the problem still there, then try to enable option:

`YDB_TABLE_ENABLE_PREPARED_DDL=true`
