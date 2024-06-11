import Driver, {IDriverSettings} from "../../driver";
import path from "path";
import fs from "fs";

import {AnonymousAuthService} from "../../credentials/anonymous-auth-service";

const DATABASE = '/local';

export async function initDriver(settings?: Partial<IDriverSettings>): Promise<Driver> {
    const certFile = process.env.YDB_SSL_ROOT_CERTIFICATES_FILE || path.join(process.cwd(), 'ydb_certs/ca.pem');
    if (!fs.existsSync(certFile)) {
        throw new Error(`Certificate file ${certFile} doesn't exist! Please use YDB_SSL_ROOT_CERTIFICATES_FILE env variable or run Docker container https://cloud.yandex.ru/docs/ydb/getting_started/ydb_docker inside working directory`);
    }
    const sslCredentials = {rootCertificates: fs.readFileSync(certFile)};
    const driver = new Driver({
        endpoint: `grpc://localhost:2136`,
        database: DATABASE,
        authService: new AnonymousAuthService(),
        sslCredentials,
        ...settings
    });
    const ready = await driver.ready(3000);
    if (!ready) {
        throw new Error('Driver is not ready!');
    }
    return driver;
}
