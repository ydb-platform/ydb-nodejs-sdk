import {Ydb} from "ydb-sdk-proto";
import TableService = Ydb.Table.V1.TableService;
import CreateSessionRequest = Ydb.Table.CreateSessionRequest;
import CreateSessionResult = Ydb.Table.CreateSessionResult;
import EventEmitter from "events";
import {IClientSettings, SessionPool} from "./session-pool";
import {Endpoint} from "../discovery";
import {IAuthService} from "../credentials";
import {Logger} from "../logging";
import {ISslCredentials} from "../ssl-credentials";
import {AuthenticatedService, ClientOptions, getOperationPayload, pessimizable} from "../utils";
import {SessionCreator} from "./session";
import {retryable} from "../retries";
import {TableSession} from "./table-session";
import TransactionSettings = Ydb.Query.TransactionSettings;

export class TableSessionCreator extends AuthenticatedService<TableService> {
    public endpoint: Endpoint;
    private readonly logger: Logger;

    constructor(endpoint: Endpoint, database: string, authService: IAuthService, logger: Logger, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions) {
        const host = endpoint.toString();
        super(host, database, 'Ydb.Table.V1.TableService', TableService, authService, sslCredentials, clientOptions);
        this.endpoint = endpoint;
        this.logger = logger;
    }
7
    @retryable()
    @pessimizable
    async create(): Promise<TableSession> {
        const response = await this.api.createSession(CreateSessionRequest.create());
        const payload = getOperationPayload(response);
        const {sessionId} = CreateSessionResult.decode(payload);
        return new TableSession(this.api, this.endpoint, sessionId, this.logger, this.getResponseMetadata.bind(this));
    }
}

class TableSessionPool extends SessionPool<TableSession> {
    protected getSessionServiceCreator(
        endpoint: Endpoint,
        database: string,
        authService: IAuthService,
        logger: Logger,
        sslCredentials: ISslCredentials | undefined,
        clientOptions: ClientOptions | undefined): SessionCreator<TableSession> {
        return new TableSessionCreator(endpoint, database, authService, logger, sslCredentials, clientOptions);
    }
}

export class TableClient extends EventEmitter {
    private pool: TableSessionPool;

    constructor(settings: IClientSettings) {
        super();
        this.pool = new TableSessionPool(settings);
    }

    public async withSession<T>(callback: (session: TableSession) => Promise<T>, timeout: number = 0): Promise<T> {
        return this.pool.withSession(callback, timeout);
    }

    public async withSessionRetry<T>(callback: (session: TableSession) => Promise<T>, timeout: number = 0, maxRetries = 10): Promise<T> {
        return this.pool.withSessionRetry(callback, timeout, maxRetries);
    }

    public async destroy() {
        await this.pool.destroy();
    }
}

class Test extends TransactionSettings {

}