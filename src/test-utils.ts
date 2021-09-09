import grpc from 'grpc';
import fs from 'fs';
import path from 'path';
import Driver from "./driver";
import {declareType, TypedData} from "./types";
import {Ydb} from "ydb-sdk-proto";
import {Column, Session, TableDescription} from "./table";
import {withRetries} from "./retries";

export const DATABASE = '/local';

export const TABLE = 'table';

export interface IRow {
    id: number;
    title: string;
}

export class Row extends TypedData {
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

export async function initDriver(): Promise<Driver> {
    const certFile = process.env.YDB_SSL_ROOT_CERTIFICATES_FILE || path.join(process.cwd(), 'ydb_certs/ca.pem');
    if (!fs.existsSync(certFile)) {
        throw new Error(`Certificate file ${certFile} doesn't exist! Please use YDB_CI_CERT_PATH env variable or run Docker container https://cloud.yandex.ru/docs/ydb/solutions/ydb_docker#start inside working directory`);
    }
    const rootCertificates = fs.readFileSync(certFile);
    const credentials = {
        getAuthMetadata() {
            return Promise.resolve(new grpc.Metadata());
        },
        sslCredentials: {
            rootCertificates,
        },
    };

    const driver = new Driver(`grpcs://localhost:2135`, DATABASE, credentials);
    const ready = await driver.ready(1000);
    if (!ready) {
        throw new Error('Driver is not ready!');
    }
    return driver;
}

export async function destroyDriver(driver: Driver): Promise<void> {
    if (driver) {
        await driver.destroy();
    }
}

export async function createTable(session: Session) {
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

export async function fillTableWithData(session: Session, rows: Row[]) {
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

