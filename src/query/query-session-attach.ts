import {Ydb} from "ydb-sdk-proto";
import {ensureCallSucceeded} from "../utils/process-ydb-operation-result";
import {StatusObject as GrpcStatusObject} from "@grpc/grpc-js/build/src/call-interface";
import {TransportError} from "../errors";
import {attachStreamSymbol, implSymbol, QuerySession} from "./query-session";

export async function attach(this:QuerySession, onStreamClosed: () => void) {
    if (this[attachStreamSymbol]) throw new Error('Already attached');
    let connected = false;
    await this[implSymbol].updateMetadata();
    return new Promise<void>((resolve, reject) => {
        this[attachStreamSymbol] = this[implSymbol].grpcServiceClient!.makeServerStreamRequest(
            '/Ydb.Query.V1.QueryService/AttachSession',
            (v) => Ydb.Query.AttachSessionRequest.encode(v).finish() as Buffer,
            Ydb.Query.SessionState.decode,
            Ydb.Query.AttachSessionRequest.create({sessionId: this.sessionId}),
            this[implSymbol].metadata);

        this[attachStreamSymbol]!.on('data', (partialResp: Ydb.Query.SessionState) => {
            this.logger.debug('attach(): data: %o', partialResp);
            if (!connected) {
                connected = true;
                try {
                    ensureCallSucceeded(partialResp);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            }
        });

        this[attachStreamSymbol]!.on('metadata', (metadata) => {
            this.logger.trace('attach(): metadata: %o', metadata);
        });

        // TODO: Ensure that on-error always returns GrpcStatusObject
        this[attachStreamSymbol]!.on('error', (err: Error & GrpcStatusObject) => {
            this.logger.trace('attach(): error: %o', err);
            if (connected) {
                // delete this[attachStream]; // uncomment when reattach policy will be implemented
                onStreamClosed();
            } else {
                reject(TransportError.convertToYdbError(err));
            }
        });

        this[attachStreamSymbol]!.on('end', () => {
            this.logger.trace('attach(): end');
            // delete this[attachStream]; // uncomment when reattach policy will be implemented
            onStreamClosed();
        });
    });
}
