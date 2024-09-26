import DiscoveryService from "../../../discovery/discovery-service";
import {ENDPOINT_DISCOVERY_PERIOD} from "../../../constants";
import {AnonymousAuthService} from "../../../credentials/anonymous-auth-service";
import {QueryService} from "../../../query/query-session-pool";
import {IExecuteResult, QuerySession} from "../../../query";
import {declareType, TypedData, TypedValues, Types} from "../../../types";
import {Ydb} from "ydb-sdk-proto";
import {getDefaultLogger} from "../../../logger/get-default-logger";
import {Context} from "../../../context";
import {ctxSymbol} from "../../../query/symbols";
import StatsMode = Ydb.Query.StatsMode;
import ExecMode = Ydb.Query.ExecMode;

if (process.env.TEST_ENVIRONMENT === 'dev') require('dotenv').config();

const DATABASE = '/local';
const ENDPOINT = process.env.YDB_ENDPOINT || 'grpc://localhost:2136';
const TABLE_NAME = 'test_table_1'

describe('Query.execute()', () => {

    let discoveryService: DiscoveryService;
    let session: QuerySession;

    beforeEach(async () => {
        await testOnOneSessionWithoutDriver();
    });

    afterEach(async () => {
        discoveryService.destroy();
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

        expect(async () => await simpleSelect()).rejects
            .toThrowError(new Error('There\'s another active operation in the session'));

        let linesCount = 0;
        for await (const resultSet of res.resultSets)
            for await (const _row of resultSet.rows)
                linesCount++;

        await res.opFinished;

        expect(linesCount).toBe(2 * linesInserted);
    });

    it('ExecMode: EXEC_MODE_UNSPECIFIED', async () => {
        await expect(async () => await session.execute({
                execMode: ExecMode.EXEC_MODE_UNSPECIFIED,
                text: 'SELECT 1;',
            })
        ).rejects.toThrowError(new Error('BadRequest (code 400010): [\n' + // TODO: Find out why
            '  {\n' +
            '    "message": "Unexpected query mode",\n' +
            '    "severity": 1\n' +
            '  }\n' +
            ']'));
    });

    it('ExecMode: EXEC_MODE_PARSE', async () => {
        await expect(async () =>
            await session.execute({
                execMode: ExecMode.EXEC_MODE_PARSE,
                text: 'SELECT 1;',
            })
        ).rejects.toThrowError(new Error('BadRequest (code 400010): [\n' + // TODO: Figure out why
            '  {\n' +
            '    "message": "Unexpected query mode",\n' +
            '    "severity": 1\n' +
            '  }\n' +
            ']'));
    });

    it('ExecMode: EXEC_MODE_VALIDATE', async () => {
        await expect(async () =>
            await session.execute({
                execMode: ExecMode.EXEC_MODE_VALIDATE,
                text: 'SELECT 1;',
            })
        ).rejects.toThrowError(new Error('BadRequest (code 400010): [\n' + // TODO: Figure out why
            '  {\n' +
            '    "message": "Unexpected query type.",\n' +
            '    "severity": 1\n' +
            '  }\n' +
            ']'));
    });

    it('ExecMode: EXEC_MODE_EXPLAIN', async () => {
        const res = await session.execute({
            execMode: ExecMode.EXEC_MODE_EXPLAIN,
            text: 'SELECT 1;',
        });

        await drainExecuteResult(res);

        expect(res.execStats?.queryPlan).toBeDefined();
        expect(res.execStats?.queryAst).toBeDefined();
    });

    it('ExecMode: EXEC_MODE_EXECUTE | undefined', async () => {
        for (const execMode of [ExecMode.EXEC_MODE_EXECUTE, undefined])
            await drainExecuteResult(await session.execute({
                execMode,
                text: 'SELECT 1;',
            }));
    });

    for (const {mode, isExpected} of [
        {mode: StatsMode.STATS_MODE_UNSPECIFIED, isExpected: false},
        {mode: StatsMode.STATS_MODE_NONE, isExpected: false},
        {mode: StatsMode.STATS_MODE_BASIC, isExpected: true},
        {mode: StatsMode.STATS_MODE_FULL, isExpected: true},
        {mode: StatsMode.STATS_MODE_PROFILE, isExpected: true},
    ]) {
        it(`statsMode: ${StatsMode[mode]}`, async () => {
            await createTestTable();
            await insertCupleLinesInTestTable();
            const res = await simpleSelect(mode);

            for await (const resultSet of res.resultSets)
                for await (const _row of resultSet.rows) {
                }

            if (isExpected)
                expect(res.execStats).not.toBeUndefined();
            else
                expect(res.execStats).toBeUndefined();
        });
    }

    it('check iterator on multi parts stream', async () => {
        await createTestTable();

        const generatedRowsCount = 5000;

        function* dataGenerator(rowsCount: number) {
            for (let id = 1; id <= rowsCount; id++)
                yield new Row({
                    id,
                    title: `title_${id}`,
                    time: new Date(),
                })
        }

        await session.execute({
            text: `
                DECLARE $table AS List<Struct<id: Uint64, title: Utf8, time: Datetime,>>;
                UPSERT INTO ${TABLE_NAME} (id, title, time)
                SELECT id, title, time FROM AS_TABLE($table);
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
                '$timestamp': TypedValues.datetime(new Date()),
            },
            text: `
                DECLARE $id1 AS Uint64;
                DECLARE $title1 AS Utf8;
                DECLARE $id2 AS Uint64;
                DECLARE $title2 AS Utf8;
                DECLARE $timestamp AS Datetime;

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
        const sessionBuilder = new QueryService(
            await discoveryService.getEndpoint(),
            DATABASE,
            authService,
            logger,
        );
        session = await sessionBuilder.createSession();
        session[ctxSymbol] = Context.createNew().ctx;
    }

    async function drainExecuteResult(res: IExecuteResult) {
        // TODO: cancel result stream
        for await (const rs of res.resultSets)
            for await (const _row of rs.rows) {
            }
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
