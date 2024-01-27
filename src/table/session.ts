import {Ydb} from "ydb-sdk-proto";
export import OperationMode = Ydb.Operations.OperationParams.OperationMode;
import EventEmitter from "events";
import {Endpoint} from "../discovery";
import {Logger} from "../logging";
import * as grpc from "@grpc/grpc-js";
import {SessionEvent} from "./session-pool";
import {retryable} from "../retries";
import {AsyncResponse, ensureOperationSucceeded, pessimizable, StreamEnd} from "../utils";
import {ResponseMetadataKeys} from "../constants";
import {MissingValue, YdbError} from "../errors";
import * as $protobuf from "protobufjs";

interface PartialResponse<T> {
    status?: (Ydb.StatusIds.StatusCode|null);
    issues?: (Ydb.Issue.IIssueMessage[]|null);
    result?: (T|null);
}


export interface ServiceWithSessions<SericeType extends $protobuf.rpc.Service> extends EventEmitter {
    createSession(request: Ydb.Table.ICreateSessionRequest): Promise<Ydb.Table.CreateSessionResponse>;
    deleteSession(request: Ydb.Table.IDeleteSessionRequest): Promise<Ydb.Table.DeleteSessionResponse>;
    Alive?(request: Ydb.Table.IKeepAliveRequest): Promise<Ydb.Table.KeepAliveResponse>;
}

export interface SessionCreator<SessionType extends Session<any>> {
    create(): Promise<SessionType>;
}

export abstract class Session<ServiceType extends ServiceWithSessions> extends EventEmitter implements Ydb.Table.ICreateSessionResult {
    private beingDeleted = false;
    private free = true;
    private closing = false;

    constructor(protected api: ServiceType, public endpoint: Endpoint, public sessionId: string, protected logger: Logger, protected getResponseMetadata: (request: object) => grpc.Metadata | undefined) {
        super();
    }

    acquire() {
        this.free = false;
        this.logger.debug(`Acquired session ${this.sessionId} on endpoint ${this.endpoint.toString()}.`);
        return this;
    }

    release() {
        this.free = true;
        this.logger.debug(`Released session ${this.sessionId} on endpoint ${this.endpoint.toString()}.`);
        this.emit(SessionEvent.SESSION_RELEASE, this);
    }

    public isFree() {
        return this.free && !this.isDeleted();
    }

    public isClosing() {
        return this.closing;
    }

    public isDeleted() {
        return this.beingDeleted;
    }

    @retryable()
    @pessimizable
    public async delete(): Promise<void> {
        if (this.isDeleted()) {
            return Promise.resolve();
        }
        this.beingDeleted = true;
        ensureOperationSucceeded(await this.api.deleteSession({sessionId: this.sessionId}));
    }

    protected processResponseMetadata(
        request: object,
        response: AsyncResponse,
        onResponseMetadata?: (metadata: grpc.Metadata) => void
    ) {
        const metadata = this.getResponseMetadata(request);
        if (metadata) {
            const serverHints = metadata.get(ResponseMetadataKeys.ServerHints) || [];
            if (serverHints.includes('session-close')) {
                this.closing = true;
            }
            onResponseMetadata?.(metadata);
        }
        return response;
    }

    protected executeStreamRequest<Req, Resp extends PartialResponse<IRes>, IRes, Res>(
        request: Req,
        apiStreamMethod: (request: Req, callback: (error: (Error|null), response?: Resp) => void) => void,
        transformer: (result: IRes) => Res,
        consumer: (result: Res) => void)
        : Promise<void> {
        return new Promise((resolve, reject) => {
            apiStreamMethod(request, (error, response) => {
                try {
                    if (error) {
                        if (error instanceof StreamEnd) {
                            resolve();
                        } else {
                            reject(error);
                        }
                    } else if (response) {
                        const operation = {
                            status: response.status,
                            issues: response.issues,
                        } as Ydb.Operations.IOperation;
                        YdbError.checkStatus(operation);

                        if (!response.result) {
                            reject(new MissingValue('Missing result value!'));
                            return;
                        }

                        const result = transformer(response.result);
                        consumer(result);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
}
