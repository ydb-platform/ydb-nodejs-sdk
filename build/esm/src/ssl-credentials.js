"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeSslCredentials = exports.makeDefaultSslCredentials = void 0;
const fs = __importStar(require("fs"));
const tls = __importStar(require("tls"));
const certs_json_1 = __importDefault(require("./certs/certs.json"));
function makeInternalRootCertificates() {
    const internalRootCertificates = Buffer.from(certs_json_1.default.internal, 'utf8');
    const fallbackSystemRootCertificates = Buffer.from(certs_json_1.default.system, 'utf8');
    let systemRootCertificates;
    const nodeRootCertificates = tls.rootCertificates;
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
