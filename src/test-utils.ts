import grpc from 'grpc';
import fs from 'fs';
import path from 'path';
import Driver from "./driver";

export const DATABASE = '/local';

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
