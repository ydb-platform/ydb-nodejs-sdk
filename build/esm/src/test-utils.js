"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fillTableWithData = exports.createTable = exports.destroyDriver = exports.initDriver = exports.Row = exports.TABLE = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const driver_1 = __importDefault(require("./driver"));
const types_1 = require("./types");
const table_1 = require("./table");
const retries_1 = require("./retries");
const credentials_1 = require("./credentials");
const DATABASE = '/local';
exports.TABLE = `table_${Math.trunc(100 * Math.random())}`;
class Row extends types_1.TypedData {
    id;
    title;
    constructor(data) {
        super(data);
        this.id = data.id;
        this.title = data.title;
    }
}
__decorate([
    (0, types_1.declareType)(types_1.Types.UINT64)
], Row.prototype, "id", void 0);
__decorate([
    (0, types_1.declareType)(types_1.Types.UTF8)
], Row.prototype, "title", void 0);
exports.Row = Row;
async function initDriver(settings) {
    const certFile = process.env.YDB_SSL_ROOT_CERTIFICATES_FILE || path_1.default.join(process.cwd(), 'ydb_certs/ca.pem');
    if (!fs_1.default.existsSync(certFile)) {
        throw new Error(`Certificate file ${certFile} doesn't exist! Please use YDB_SSL_ROOT_CERTIFICATES_FILE env variable or run Docker container https://cloud.yandex.ru/docs/ydb/getting_started/ydb_docker inside working directory`);
    }
    const sslCredentials = { rootCertificates: fs_1.default.readFileSync(certFile) };
    const driver = new driver_1.default(Object.assign({
        endpoint: `grpcs://localhost:2135`,
        database: DATABASE,
        authService: new credentials_1.AnonymousAuthService(),
        sslCredentials,
    }, settings));
    const ready = await driver.ready(3000);
    if (!ready) {
        throw new Error('Driver is not ready!');
    }
    return driver;
}
exports.initDriver = initDriver;
async function destroyDriver(driver) {
    if (driver) {
        await driver.destroy();
    }
}
exports.destroyDriver = destroyDriver;
async function createTable(session) {
    await session.dropTable(exports.TABLE);
    await session.createTable(exports.TABLE, new table_1.TableDescription()
        .withColumn(new table_1.Column('id', types_1.Types.optional(types_1.Types.UINT64)))
        .withColumn(new table_1.Column('title', types_1.Types.optional(types_1.Types.UTF8)))
        .withPrimaryKey('id'));
}
exports.createTable = createTable;
async function fillTableWithData(session, rows) {
    const query = `
DECLARE $data AS List<Struct<id: Uint64, title: Utf8>>;

REPLACE INTO ${exports.TABLE}
SELECT * FROM AS_TABLE($data);`;
    await (0, retries_1.withRetries)(async () => {
        const preparedQuery = await session.prepareQuery(query);
        await session.executeQuery(preparedQuery, {
            '$data': Row.asTypedCollection(rows),
        });
    });
}
exports.fillTableWithData = fillTableWithData;
