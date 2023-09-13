"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fillTableWithData = void 0;
const test_utils_1 = require("../test-utils");
const table_1 = require("../table");
const types_1 = require("../types");
const retries_1 = require("../retries");
async function createTable(session) {
    await session.dropTable(test_utils_1.TABLE);
    await session.createTable(test_utils_1.TABLE, new table_1.TableDescription()
        .withColumn(new table_1.Column('id', types_1.Types.optional(types_1.Types.UINT64)))
        .withColumn(new table_1.Column('field1', types_1.Types.optional(types_1.Types.TEXT)))
        .withColumn(new table_1.Column('field2', types_1.Types.optional(types_1.Types.BYTES)))
        .withColumn(new table_1.Column('field3', types_1.Types.optional(types_1.Types.YSON)))
        .withPrimaryKey('id'));
}
class Row extends types_1.TypedData {
    constructor(data) {
        super(data);
        this.id = data.id;
        this.field1 = data.field1;
        this.field2 = data.field2;
        this.field3 = data.field3;
    }
}
__decorate([
    (0, types_1.declareType)(types_1.Types.UINT64)
], Row.prototype, "id", void 0);
__decorate([
    (0, types_1.declareType)(types_1.Types.TEXT)
], Row.prototype, "field1", void 0);
__decorate([
    (0, types_1.declareType)(types_1.Types.BYTES)
], Row.prototype, "field2", void 0);
__decorate([
    (0, types_1.declareType)(types_1.Types.YSON)
], Row.prototype, "field3", void 0);
async function fillTableWithData(session, rows) {
    const query = `
DECLARE $data AS List<Struct<id: Uint64, field1: Text, field2: String, field3: Yson>>;

REPLACE INTO ${test_utils_1.TABLE}
SELECT * FROM AS_TABLE($data);`;
    await (0, retries_1.withRetries)(async () => {
        const preparedQuery = await session.prepareQuery(query);
        await session.executeQuery(preparedQuery, {
            $data: Row.asTypedCollection(rows),
        });
    });
}
exports.fillTableWithData = fillTableWithData;
describe('bytestring identity', () => {
    let driver;
    let actualRows;
    const initialRows = [
        new Row({
            id: 0,
            field1: 'zero',
            field2: Buffer.from('half'),
            field3: Buffer.from('<a=1>[3;%false]'),
        }),
    ];
    afterAll(async () => await (0, test_utils_1.destroyDriver)(driver));
    beforeAll(async () => {
        driver = await (0, test_utils_1.initDriver)();
        await driver.tableClient.withSession(async (session) => {
            await createTable(session);
            await fillTableWithData(session, initialRows);
            const { resultSets } = await session.executeQuery(`SELECT * FROM ${test_utils_1.TABLE}`);
            actualRows = Row.createNativeObjects(resultSets[0]);
        });
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
