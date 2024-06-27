"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeSslCredentials = exports.makeDefaultSslCredentials = void 0;
var fs = require("fs");
var tls = require("tls");
// noinspection ES6PreferShortImport
var certs_json_1 = require("../certs/certs.json");
function makeInternalRootCertificates() {
    var internalRootCertificates = Buffer.from(certs_json_1.default.internal, 'utf8');
    var fallbackSystemRootCertificates = Buffer.from(certs_json_1.default.system, 'utf8');
    var systemRootCertificates;
    var nodeRootCertificates = tls.rootCertificates;
    if (nodeRootCertificates && nodeRootCertificates.length > 0) {
        systemRootCertificates = Buffer.from(nodeRootCertificates.join('\n'));
    }
    else {
        systemRootCertificates = fallbackSystemRootCertificates;
    }
    return Buffer.concat([internalRootCertificates, systemRootCertificates]);
}
function makeDefaultSslCredentials() {
    if (process.env.YDB_SSL_ROOT_CERTIFICATES_FILE) {
        return { rootCertificates: fs.readFileSync(process.env.YDB_SSL_ROOT_CERTIFICATES_FILE) };
    }
    return { rootCertificates: makeInternalRootCertificates() };
}
exports.makeDefaultSslCredentials = makeDefaultSslCredentials;
function makeSslCredentials(endpoint, logger, sslCredentials) {
    if (endpoint.startsWith('grpc://')) {
        logger.debug('Protocol grpc specified in endpoint, using insecure connection.');
        return undefined;
    }
    if (endpoint.startsWith('grpcs://')) {
        logger.debug('Protocol grpcs specified in endpoint, using SSL connection.');
    }
    else {
        logger.debug('No protocol specified in endpoint, using SSL connection.');
    }
    if (sslCredentials) {
        return sslCredentials;
    }
    return makeDefaultSslCredentials();
}
exports.makeSslCredentials = makeSslCredentials;
