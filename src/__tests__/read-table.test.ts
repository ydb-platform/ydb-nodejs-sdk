import Driver from '../driver';
import {
    createTable,
    DATABASE,
    destroyDriver,
    fillTableWithData,
    initDriver,
    Row,
    TABLE
} from '../test-utils';
import {ReadTableSettings, Session} from '../table';
import {Primitive, TypedData} from '../types';
import {Ydb} from 'ydb-sdk-proto';

async function readTable(session: Session, settings: ReadTableSettings): Promise<TypedData[]> {
    const rows: TypedData[] = [];

    await session.streamReadTable(`${DATABASE}/${TABLE}`, (result) => {
        if (result.resultSet) {
            rows.push(...Row.createNativeObjects(result.resultSet));
        }
    }, settings);

    return rows;
}

function tupleValue(...values: Ydb.ITypedValue[]): Ydb.ITypedValue {
    return {
        type: {
            tupleType: {
                elements: values.map((v) => v.type).filter((t) => t) as Ydb.IType[],
            },
        },
        value: {
            items: values.map((v) => v.value).filter((v) => v) as Ydb.IValue[],
        },
    }
}

function optionalValue(value: Ydb.ITypedValue): Ydb.ITypedValue {
    return {
        type: {
            optionalType: {
                item: value.type,
            },
        },
        value: value.value,
    }
}

describe('Read table', () => {
    let driver: Driver;

    beforeAll(async () => {
        driver = await initDriver();
    });

    afterAll(async () => await destroyDriver(driver));

    it('Test', async () => {
        await driver.tableClient.withSession(async (session) => {
            const expectedRows = [
                new Row({id: 1, title: 'one'}),
                new Row({id: 2, title: 'two'}),
            ];

            await createTable(session);
            await fillTableWithData(session, expectedRows);

            {
                const rows = await readTable(session, new ReadTableSettings());
                expect(rows).toEqual(expectedRows);
            }

            {
                const rows = await readTable(session, new ReadTableSettings().withKeyRange({
                    greaterOrEqual: tupleValue(optionalValue(Primitive.uint64(1))),
                    lessOrEqual: tupleValue(optionalValue(Primitive.uint64(2))),
                }));

                expect(rows).toEqual(expectedRows);
            }

            {
                const rows = await readTable(session, new ReadTableSettings().withKeyRange({
                    greater: tupleValue(optionalValue(Primitive.uint64(1))),
                    lessOrEqual: tupleValue(optionalValue(Primitive.uint64(2))),
                }));

                expect(rows).toEqual(expectedRows.slice(1));
            }
        });
    });
});
