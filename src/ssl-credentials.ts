import * as fs from 'fs';
import * as tls from 'tls';

// noinspection ES6PreferShortImport
import { Logger } from './logging';
import * as certs from './certs';

function makeInternalRootCertificates() {
    const internalRootCertificates = Buffer.from(certs.internal, 'utf8')
    const fallbackSystemRootCertificates = Buffer.from(certs.system, 'utf8')

    let systemRootCertificates: Buffer;
    const nodeRootCertificates = tls.rootCertificates as string[] | undefined;
    if (nodeRootCertificates && nodeRootCertificates.length > 0) {
        systemRootCertificates = Buffer.from(nodeRootCertificates.join('\n'));
    } else {
        systemRootCertificates = fallbackSystemRootCertificates;
    }

    return Buffer.concat([internalRootCertificates, systemRootCertificates]);
}

export function makeDefaultSslCredentials() {
    if (process.env.YDB_SSL_ROOT_CERTIFICATES_FILE) {
        return {rootCertificates: fs.readFileSync(process.env.YDB_SSL_ROOT_CERTIFICATES_FILE)};
    }

    return {rootCertificates: makeInternalRootCertificates()};
}

export function makeSslCredentials(endpoint: string, logger: Logger, sslCredentials: ISslCredentials | undefined): ISslCredentials | undefined {
    if (endpoint.startsWith('grpc://')) {
        logger.debug('Protocol grpc specified in endpoint, using insecure connection.');
        return undefined;
    }
    if (endpoint.startsWith('grpcs://')) {
        logger.debug('Protocol grpcs specified in endpoint, using SSL connection.');
    } else {
        logger.debug('No protocol specified in endpoint, using SSL connection.')
    }

    if (sslCredentials) {
        return sslCredentials;
    }
    return makeDefaultSslCredentials();
}

export interface ISslCredentials {
    rootCertificates?: Buffer,
    clientPrivateKey?: Buffer,
    clientCertChain?: Buffer
}
