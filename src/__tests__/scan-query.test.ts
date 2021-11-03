import Driver from '../driver';
import {DATABASE, destroyDriver, initDriver} from '../test-utils';
import {Column, Session, TableDescription} from '../table';
import {Ydb} from 'ydb-sdk-proto';
import {declareType, TypedData} from '../types';
import {withRetries} from '../retries';

const TABLE = 'table';

interface IRow {
    id: number;
    title: string;
}

class Row extends TypedData {
    @declareType({typeId: Ydb.Type.PrimitiveTypeId.UINT64})
    public id: number;

    @declareType({typeId: Ydb.Type.PrimitiveTypeId.UTF8})
    public title: string;

    constructor(data: IRow) {
        super(data);
        this.id = data.id;
        this.title = data.title;
    }
}

async function createTable(session: Session) {
    await session.dropTable(TABLE);
    await session.createTable(
        TABLE,
        new TableDescription()
            .withColumn(new Column(
                'id',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UINT64}}})
            ))
            .withColumn(new Column(
                'title',
                Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UTF8}}})
            ))
            .withPrimaryKey('id')
    );
}

async function fillTableWithData(session: Session, rows: Row[]) {
    const query = `
PRAGMA TablePathPrefix("${DATABASE}");

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

async function executeScanQuery(session: Session): Promise<TypedData[]> {
    const query = `
        PRAGMA TablePathPrefix("${DATABASE}");
        SELECT * FROM ${TABLE};`;

    const rows: TypedData[] = [];

    await session.streamExecuteScanQuery(query, (result) => {
        if (result.resultSet) {
            rows.push(...Row.createNativeObjects(result.resultSet));
        }
    });

    return rows;
}

describe('Connection', () => {
    let driver: Driver;

    beforeAll(async () => {
        driver = await initDriver();
    });

    afterAll(async () => await destroyDriver(driver));

    it('Test connection', async () => {
        await driver.tableClient.withSession(async (session) => {
            const expectedRows = [
                new Row({id: 1, title: 'one'}),
                new Row({id: 2, title: 'two'}),
            ];

            await createTable(session);
            await fillTableWithData(session, expectedRows);

            const rows = await executeScanQuery(session);

            expect(rows).toEqual(expectedRows);
        });
    });
});
