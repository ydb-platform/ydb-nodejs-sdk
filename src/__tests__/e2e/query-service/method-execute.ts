import DiscoveryService from "../../../discovery/discovery-service";
import {ENDPOINT_DISCOVERY_PERIOD} from "../../../constants";
import {AnonymousAuthService} from "../../../credentials/anonymous-auth-service";
import {getLogger} from "../../../logging";
import {SessionBuilder} from "../../../query/query-session-pool";
import {QuerySession} from "../../../query/query-session";
import * as symbols from "../../../query/symbols";
import {declareType, TypedData, TypedValues, Types} from "../../../types";
import {Ydb} from "ydb-sdk-proto";
import StatsMode = Ydb.Query.StatsMode;

const DATABASE = '/local';
const ENDPOINT = 'grpcs://localhost:2136';
const TABLE_NAME = 'test_table_20240313'

describe('Query.execute()', () => {

    let discoveryService: DiscoveryService;
    let session: QuerySession;

    beforeAll(async () => {
        await testOnOneSessionWithoutDriver();
    });

    afterAll(async () => {
        discoveryService.destroy();
        await session[symbols.sessionRelease]();
        await session.delete();
    });

    it('create table', async () => {
        await createTestTable();
    });

    it('simple insert', async () => {
        await createTestTable();
        await insertCupleLinesInTestTable();
    });

    it('simple select', async () => {
        await createTestTable();
        const linesInserted = await insertCupleLinesInTestTable();
        const res = await simpleSelect();

        let linesCount = 0;
        for await (const resultSet of res.resultSets)
            for await (const _row of resultSet.rows)
                linesCount++;

        expect(linesCount).toBe(2 * linesInserted);
    });

    it('simple select', async () => {
        await createTestTable();
        const linesInserted = await insertCupleLinesInTestTable();
        const res = await simpleSelect();

        let linesCount = 0;
        for await (const resultSet of res.resultSets)
            for await (const _row of resultSet.rows)
                linesCount++;

        expect(linesCount).toBe(2 * linesInserted);
    });

    for (const {mode, isExpected} of [
        {mode: StatsMode.STATS_MODE_UNSPECIFIED, isExpected: false},
        {mode: StatsMode.STATS_MODE_NONE, isExpected: false},
        {mode: StatsMode.STATS_MODE_BASIC, isExpected: true},
        {mode: StatsMode.STATS_MODE_FULL, isExpected: true},
        {mode: StatsMode.STATS_MODE_PROFILE, isExpected: true},
    ])
    {
        it(`statsMode: ${StatsMode[mode]}`, async () => {
            await createTestTable();
            await insertCupleLinesInTestTable();
            const res = await simpleSelect(mode);

            for await (const resultSet of res.resultSets)
                for await (const _row of resultSet.rows) {}

            if (isExpected)
                expect(res.execStats).not.toBeUndefined();
            else
                expect(res.execStats).toBeUndefined();
        });
    }

    it('check iterator on multi parts stream', async () => {
        await createTestTable();

        const generatedRowsCount = 5000;

        function *dataGenerator(rowsCount: number) {
            for (let id = 1; id <= rowsCount; id++)
                yield new Row({
                    id,
                    title: `title_${id}`,
                    time: new Date(),
                })
        }

        await session.execute({
            text: `
                UPSERT INTO ${TABLE_NAME} (id, title, time)
                SELECT id, title, time FROM AS_TABLE($table)
            `,
            parameters: {
                '$table': Row.asTypedCollection([...dataGenerator(generatedRowsCount)]),
            }
        });

        const res = await simpleSelect();

        let linesCount = 0;
        for await (const resultSet of res.resultSets)
            for await (const _row of resultSet.rows)
                linesCount++;

        expect(linesCount).toBe(2 * generatedRowsCount);
    });

    // number of operations under one transaction
    // doTx - txControl
    // convert to native type
    // update / insert
    // error
    // timeout

    async function createTestTable() {
        await session.execute({
            text: `
                DROP TABLE IF EXISTS ${TABLE_NAME};

                CREATE TABLE ${TABLE_NAME}
                (
                    id    UInt64,
                    title Utf8, -- NOT NULL,
                    time  Timestamp,
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
                INSERT INTO ${TABLE_NAME} (id, title, time)
                VALUES ($id1, $title1, $timestamp);
                INSERT INTO ${TABLE_NAME} (id, title, time)
                VALUES ($id2, $title2, $timestamp);
            `,
        });
        return 2;
    }

    async function simpleSelect(statsMode?: Ydb.Query.StatsMode) {
        return await session.execute({
            statsMode,
            text: `
                SELECT *
                FROM ${TABLE_NAME};
                SELECT * -- double
                FROM ${TABLE_NAME};
            `,
            // concurrentResultSets: false,
        });
    }

    async function testOnOneSessionWithoutDriver() {
        const logger = getLogger();
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

interface IRow {
    id: number;
    title: string;
    time: Date;
}

class Row extends TypedData {
    @declareType(Types.UINT64)
    public id: number;

    @declareType(Types.UTF8)
    public title: string;

    @declareType(Types.DATETIME)
    public time: Date;

    constructor(data: IRow) {
        super(data);
        this.id = data.id;
        this.title = data.title;
        this.time = data.time;
    }
}
