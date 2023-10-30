import fs from 'fs';
import path from 'path';
import Driver, { IDriverSettings } from './driver';
import { declareType, TypedData, Types } from './types';
import { Column, Session, TableDescription } from './table';
import { withRetries } from './retries';
import { AnonymousAuthService } from './credentials';

const DATABASE = '/local';

export const TABLE = `table_${Math.trunc(100 * Math.random())}`;

export interface IRow {
    id: number;
    title: string;
}

export class Row extends TypedData {
    @declareType(Types.UINT64)
    public id: number;

    @declareType(Types.UTF8)
    public title: string;

    constructor(data: IRow) {
        super(data);
        this.id = data.id;
        this.title = data.title;
    }
}

export const initDriver = async (settings?: Partial<IDriverSettings>): Promise<Driver> => {
    const certFile = process.env.YDB_SSL_ROOT_CERTIFICATES_FILE || path.join(process.cwd(), 'ydb_certs/ca.pem');

    if (!fs.existsSync(certFile)) {
        throw new Error(`Certificate file ${certFile} doesn't exist! Please use YDB_SSL_ROOT_CERTIFICATES_FILE env variable or run Docker container https://cloud.yandex.ru/docs/ydb/getting_started/ydb_docker inside working directory`);
    }
    const sslCredentials = { rootCertificates: fs.readFileSync(certFile) };

    const driver = new Driver({
        endpoint: 'grpcs://localhost:2135',
        database: DATABASE,
        authService: new AnonymousAuthService(),
        sslCredentials,
        ...settings,
    });
    const ready = await driver.ready(3000);

    if (!ready) {
        throw new Error('Driver is not ready!');
    }

    return driver;
};

export const destroyDriver = async (driver: Driver): Promise<void> => {
    if (driver) {
        await driver.destroy();
    }
};

export const createTable = async (session: Session) => {
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
            .withPrimaryKey('id'),
    );
};

export const fillTableWithData = async (session: Session, rows: Row[]) => {
    const query = `
DECLARE $data AS List<Struct<id: Uint64, title: Utf8>>;

REPLACE INTO ${TABLE}
SELECT * FROM AS_TABLE($data);`;

    await withRetries(async () => {
        const preparedQuery = await session.prepareQuery(query);

        await session.executeQuery(preparedQuery, {
            $data: Row.asTypedCollection(rows),
        });
    });
};
