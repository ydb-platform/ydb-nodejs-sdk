import DiscoveryService from "../../../discovery/discovery-service";
import {QuerySession, RowType} from "../../../query";
import {AnonymousAuthService} from "../../../credentials/anonymous-auth-service";
import {ENDPOINT_DISCOVERY_PERIOD} from "../../../constants";
import {SessionBuilder} from "../../../query/query-session-pool";
import {declareType, TypedData, TypedValues, Types} from "../../../types";
import {Ydb} from "ydb-sdk-proto";
import {getDefaultLogger} from "../../../logger/get-default-logger";

const DATABASE = '/local';
const ENDPOINT = 'grpcs://localhost:2136';
const TABLE_NAME = 'test_table_3'

interface IRow {
    id: number;
    rowTitle: string;
    time: Date;
}

class Row extends TypedData {
    @declareType(Types.UINT64)
    public id: number;

    @declareType(Types.UTF8)
    public rowTitle: string;

    @declareType(Types.DATETIME)
    public time: Date;

    constructor(data: IRow) {
        super(data);
        this.id = data.id;
        this.rowTitle = data.rowTitle;
        this.time = data.time;
    }
}

describe('Rows conversion', () => {
    let discoveryService: DiscoveryService;
    let session: QuerySession;

    beforeAll(async () => {
        await testOnOneSessionWithoutDriver();
    });

    afterAll(async () => {
        discoveryService.destroy();
        await session.delete();
    });

    it('Ydb to native', async () => {
        await createTestTable();
        await insertCupleLinesInTestTable();
        const res = await simpleSelect(RowType.Native);

        for await (const rs of res.resultSets) {
            expect(rs.index).toBe(0);

            expect(rs.columns[0]).toBe('id');
            expect(rs.columns[1]).toBe('rowTitle'); // as camel case

            const {value: row1} = await rs.rows.next();
            expect(row1!.id).toBe(1);
            expect(row1!.rowTitle).toBe('Some title1');

            const {value: row2} = await rs.rows.next();
            expect(row2!.id).toBe(2);
            expect(row2!.rowTitle).toBe('Some title2');
        }
    });

    it('Ydb to typed structure', async () => {
        await createTestTable();
        await insertCupleLinesInTestTable();
        const res = await simpleSelect(RowType.Ydb);

        for await (const rs of res.resultSets) {
            expect((rs.columns[0] as Ydb.IColumn).name).toBe('id');
            expect((rs.columns[1] as Ydb.IColumn).name).toBe('row_title'); // snake case as in YDB

            expect(rs.index).toBe(0);
            const typedRows= rs.typedRows(Row);

            const {value: row1} = await typedRows.next();
            expect(row1!.id).toBe(1);
            expect(row1!.rowTitle).toBe('Some title1');

            const {value: row2} = await typedRows.next();
            expect(row2!.id).toBe(2);
            expect(row2!.rowTitle).toBe('Some title2');
        }
    });

    async function createTestTable() {
        await session.execute({
            text: `
                DROP TABLE IF EXISTS ${TABLE_NAME};

                CREATE TABLE ${TABLE_NAME}
                (
                    id        UInt64,
                    row_title Utf8, -- NOT NULL,
                    time      Timestamp,
                    PRIMARY KEY (id)
                );`,
        });
    }

    async function insertCupleLinesInTestTable() {
        await session.execute({
            parameters: {
                '$id1': TypedValues.uint64(1),
                '$title1': TypedValues.text('Some title1'),
                '$id2': TypedValues.uint64(2),
                '$title2': TypedValues.text('Some title2'),
                '$timestamp': TypedValues.timestamp(new Date()),
            },
            text: `
                INSERT INTO ${TABLE_NAME} (id, row_title, time)
                VALUES ($id1, $title1, $timestamp);
                INSERT INTO ${TABLE_NAME} (id, row_title, time)
                VALUES ($id2, $title2, $timestamp);
            `,
        });
        return 2;
    }

    async function simpleSelect(rowMode: RowType) {
        return await session.execute({
            rowMode,
            text: `
                SELECT *
                FROM ${TABLE_NAME};
            `,
            // concurrentResultSets: false,
        });
    }

    async function testOnOneSessionWithoutDriver() {
        const logger = getDefaultLogger();
        const authService = new AnonymousAuthService();

        discoveryService = new DiscoveryService({
            endpoint: ENDPOINT,
            database: DATABASE,
            authService,
            discoveryPeriod: ENDPOINT_DISCOVERY_PERIOD,
            logger,
        });

        await discoveryService.ready(ENDPOINT_DISCOVERY_PERIOD);

        const sessionBuilder = new SessionBuilder(
            await discoveryService.getEndpoint(),
            DATABASE,
            authService,
            logger,
        );

        session = await sessionBuilder.create();
    }
});
