import {AUTO_TX, Column, ExecuteQuerySettings, TableDescription, TableSession} from "../../table";
// import {withRetries} from "../../retries_obsoleted";
import {Types} from "../../types";
import {Row} from "./row";

export const TABLE = `table_${Math.trunc(100 * Math.random())}`;

export async function createTable(session: TableSession) {
    await session.dropTable(TABLE);
    await session.createTable(
        TABLE,
        new TableDescription()
            .withColumn(new Column(
                'id',
                Types.optional(Types.UINT64),
            ))
            .withColumn(new Column(
                'title',
                Types.optional(Types.UTF8),
            ))
            .withPrimaryKey('id')
    );
}

export async function fillTableWithData(session: TableSession, rows: Row[]) {
    const query = `
DECLARE $data AS List<Struct<id: Uint64, title: Utf8>>;

REPLACE INTO ${TABLE}
SELECT * FROM AS_TABLE($data);`;

    // Now we can specify that the operation should be repeated in case of an error by specifying that it is idempotent

    // Old code:

    // await withRetries(async () => {
    //     const preparedQuery = await session.prepareQuery(query);
    //     await session.executeQuery(preparedQuery, {
    //         '$data': Row.asTypedCollection(rows),
    //     });
    // });

    // New code variant:

    const preparedQuery = await session.prepareQuery(query);
    await session.executeQuery(preparedQuery, {
            '$data': Row.asTypedCollection(rows),
        },
        AUTO_TX,
        new ExecuteQuerySettings().withIdempotent(true));
}
