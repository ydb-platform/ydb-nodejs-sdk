import Driver from '../../driver';
import {destroyDriver, initDriver, TABLE} from '../../test-utils';
import {Column, Session, TableDescription} from '../../table';
import {declareType, TypedData, Types} from '../../types';
import {withRetries} from '../../retries';
import {ContextWithLogger} from "../../context-with-logger";

async function createTable(session: Session) {
    await session.dropTable(TABLE);
    await session.createTable(
        TABLE,
        new TableDescription()
            .withColumn(new Column('id', Types.optional(Types.UINT64)))
            .withColumn(new Column('field1', Types.optional(Types.TEXT)))
            .withColumn(new Column('field2', Types.optional(Types.BYTES)))
            .withColumn(new Column('field3', Types.optional(Types.YSON)))
            .withPrimaryKey('id'),
    );
}

export interface IRow {
    id: number;
    field1: string;
    field2: Buffer;
    field3: Buffer;
}

class Row extends TypedData {
    @declareType(Types.UINT64)
    public id: number;

    @declareType(Types.TEXT)
    public field1: string;

    @declareType(Types.BYTES)
    public field2: Buffer;

    @declareType(Types.YSON)
    public field3: Buffer;

    constructor(data: IRow) {
        super(data);
        this.id = data.id;
        this.field1 = data.field1;
        this.field2 = data.field2;
        this.field3 = data.field3;
    }
}

export async function fillTableWithData(session: Session, rows: Row[]) {
    const query = `
DECLARE $data AS List<Struct<id: Uint64, field1: Text, field2: String, field3: Yson>>;

REPLACE INTO ${TABLE}
SELECT * FROM AS_TABLE($data);`;

    await withRetries(async () => {
        const preparedQuery = await session.prepareQuery(query);
        await session.executeQuery(preparedQuery, {
            $data: Row.asTypedCollection(rows),
        });
    });
}

describe('bytestring identity', () => {
    let driver: Driver;
    let actualRows: Row[];
    const initialRows = [
        new Row({
            id: 0,
            field1: 'zero',
            field2: Buffer.from('half'),
            field3: Buffer.from('<a=1>[3;%false]'),
        }),
    ];

    afterAll(async () => await destroyDriver(driver));

    beforeAll(async () => {
        driver = await initDriver();
        await ContextWithLogger.getSafe(driver.logger, 'test.beforeAll').do(() =>
            driver.tableClient.withSession(async (session) => {
                await createTable(session);
                await fillTableWithData(session, initialRows);

                const {resultSets} = await session.executeQuery(`SELECT *
                                                                 FROM ${TABLE}`);
                actualRows = Row.createNativeObjects(resultSets[0]) as Row[];
            }));
    });

    it('Types.TEXT keeps the original string in write-read cycle', () => {
        expect(actualRows[0].field1).toEqual('zero');
    });

    it('Types.BYTES keeps the original string in write-read cycle', () => {
        expect(actualRows[0].field2.toString()).toEqual('half');
    });

    it('Types.YSON keeps the original string in write-read cycle', () => {
        expect(actualRows[0].field3).toEqual('<a=1>[3;%false]');
    });
});
