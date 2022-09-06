// noinspection ES6PreferShortImport
import { Logger } from './logging';
import fs from 'fs';
import path from 'path';

const CERTIFICATES_FOLDER = 'certs'
const RELATIVE_PATH = process.env.TEST_ENVIRONMENT ? '../' : './'
const RESOLVED_PATH = path.join(__dirname, RELATIVE_PATH, CERTIFICATES_FOLDER)
const FALLBACK_INTERNAL_ROOT_CERTS = path.join(RESOLVED_PATH, 'internal.pem');
const FALLBACK_SYSTEM_ROOT_CERTS = path.join(RESOLVED_PATH, 'system.pem');

function makeInternalRootCertificates() {
    if (!fs.existsSync(FALLBACK_INTERNAL_ROOT_CERTS)
     || !fs.existsSync(FALLBACK_SYSTEM_ROOT_CERTS)) {
        throw new Error(certificateNotFoundMessage)
    }

    const internalRootCertificates = fs.readFileSync(FALLBACK_INTERNAL_ROOT_CERTS)
    const fallbackSystemRootCertificates = fs.readFileSync(FALLBACK_SYSTEM_ROOT_CERTS)

    let systemRootCertificates: Buffer;
    const tls = require('tls');
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

const certificateNotFoundMessage = `No certificate found
It seems that you are using grpcs (secure) endpoint in a bundled environment.
Either provide YDB_SSL_ROOT_CERTIFICATES_FILE environment variable
or copy contents of ydb-nodejs-sdk/certs to ./certs path relative to the bundled file
`

export interface ISslCredentials {
    rootCertificates?: Buffer,
    clientPrivateKey?: Buffer,
    clientCertChain?: Buffer
}
