import {Ydb} from "ydb-sdk-proto";
import {ensureCallSucceeded} from "../utils/process-ydb-operation-result";
import {StatusObject as GrpcStatusObject} from "@grpc/grpc-js/build/src/call-interface";
import {TransportError} from "../errors";
import {attachStream, impl, Query_V1, QuerySession} from "./query-session";

export async function attach(this:QuerySession, onStreamClosed: () => void) {
    if (this[attachStream]) throw new Error('Already attached');
    let connected = false;
    await this[impl].updateMetadata();
    return new Promise<void>((resolve, reject) => {
        this[attachStream] = this[impl].grpcClient!.makeServerStreamRequest(
            Query_V1.AttachSession,
            (v) => Ydb.Query.AttachSessionRequest.encode(v).finish() as Buffer,
            Ydb.Query.SessionState.decode,
            Ydb.Query.AttachSessionRequest.create({sessionId: this.sessionId}),
            this[impl].metadata);

        this[attachStream]!.on('data', (partialResp: Ydb.Query.SessionState) => {
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

        this[attachStream]!.on('metadata', (metadata) => {
            this.logger.trace('attach(): metadata: %o', metadata);
        });

        // TODO: Ensure that on-error always returns GrpcStatusObject
        this[attachStream]!.on('error', (err: Error & GrpcStatusObject) => {
            this.logger.trace('attach(): error: %o', err);
            if (connected) {
                // delete this[attachStream]; // uncomment when reattach policy will be implemented
                onStreamClosed();
            } else {
                reject(TransportError.convertToYdbError(err));
            }
        });

        this[attachStream]!.on('end', () => {
            this.logger.trace('attach(): end');
            // delete this[attachStream]; // uncomment when reattach policy will be implemented
            onStreamClosed();
        });
    });
}
