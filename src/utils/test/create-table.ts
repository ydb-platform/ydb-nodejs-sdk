import {Column, TableDescription, TableSession} from "../../table";
import {withRetries} from "../../retries/retries";
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

    await withRetries(async () => {
        const preparedQuery = await session.prepareQuery(query);
        await session.executeQuery(preparedQuery, {
            '$data': Row.asTypedCollection(rows),
        });
    });
}
