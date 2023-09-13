/// <reference types="node" />
import { Logger } from './logging';
export declare function makeDefaultSslCredentials(): {
    rootCertificates: Buffer;
};
export declare function makeSslCredentials(endpoint: string, logger: Logger, sslCredentials: ISslCredentials | undefined): ISslCredentials | undefined;
export interface ISslCredentials {
    rootCertificates?: Buffer;
    clientPrivateKey?: Buffer;
    clientCertChain?: Buffer;
}
