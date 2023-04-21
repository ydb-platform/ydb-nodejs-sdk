import { ExecuteQuerySettings, OperationParams } from 'ydb-sdk'

export class QueryBuilder {
  readonly readExecuteQuerySettings: ExecuteQuerySettings
  readonly writeExecuteQuerySettings: ExecuteQuerySettings
  readonly readQuery: string
  readonly writeQuery: string

  constructor(private tableName: string, readTimeout: number, writeTimeout: number) {
    this.readQuery = `DECLARE $id AS Uint64;
SELECT id, payload_str, payload_double, payload_timestamp, payload_hash
FROM \`${this.tableName}\` WHERE id = $id AND hash = Digest::NumericHash($id);`

    this.writeQuery = `DECLARE $id AS Uint64;
DECLARE $payload_str AS Utf8;
DECLARE $payload_double AS Double;
DECLARE $payload_timestamp AS Timestamp;
UPSERT INTO \`${this.tableName}\` (
  id, hash, payload_str, payload_double, payload_timestamp
) VALUES (
  $id, Digest::NumericHash($id), $payload_str, $payload_double, $payload_timestamp
);`

    this.readExecuteQuerySettings = new ExecuteQuerySettings()
      .withKeepInCache(true)
      .withOperationParams(
        new OperationParams().withOperationTimeout({
          nanos: readTimeout * 1000 * 1000,
        })
      )
    this.writeExecuteQuerySettings = new ExecuteQuerySettings()
      .withKeepInCache(true)
      .withOperationParams(
        new OperationParams().withOperationTimeout({
          nanos: writeTimeout * 1000 * 1000,
        })
      )
  }
}
