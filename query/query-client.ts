import {Ydb} from "ydb-sdk-proto";
import QueryService = Ydb.Query.V1.QueryService;
import CreateSessionRequest = Ydb.Query.CreateSessionRequest;
import CreateSessionResult = Ydb.Query.CreateSessionResult;
import EventEmitter from "events";
import {IClientSettings, SessionPool} from "./session-pool";
import {Endpoint} from "../discovery";
import {IAuthService} from "../credentials";
import {Logger} from "../logging";
import {ISslCredentials} from "../ssl-credentials";
import {AuthenticatedService, ClientOptions, getOperationPayload, pessimizable} from "../utils";
import {SessionCreator} from "../table";
import {retryable} from "../retries";
import {QuerySession} from "./query-session";

export class QuerySessionCreator extends AuthenticatedService<QueryService> {
    public endpoint: Endpoint;
    private readonly logger: Logger;

    constructor(endpoint: Endpoint, database: string, authService: IAuthService, logger: Logger, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions) {
        const host = endpoint.toString();
        super(host, database, 'Ydb.Query.V1.QueryService', QueryService, authService, sslCredentials, clientOptions);
        this.endpoint = endpoint;
        this.logger = logger;
    }

    @retryable()
    @pessimizable
    async create(): Promise<QuerySession> {
        const response = await this.api.createSession(CreateSessionRequest.create());
        const payload = getOperationPayload(response);
        const {sessionId} = CreateSessionResult.decode(payload);
        return new QuerySession(this.api, this.endpoint, sessionId, this.logger, this.getResponseMetadata.bind(this));
    }
}

class QuerySessionPool extends SessionPool<QuerySession> {
    protected getSessionServiceCreator(
        endpoint: Endpoint,
        database: string,
        authService: IAuthService,
        logger: Logger,
        sslCredentials: ISslCredentials | undefined,
        clientOptions: ClientOptions | undefined): SessionCreator<QuerySession> {
        return new QuerySessionCreator(endpoint, database, authService, logger, sslCredentials, clientOptions);
    }
}

export class QueryClient extends EventEmitter {
    private pool: QuerySessionPool;

    constructor(settings: IClientSettings) {
        super();
        this.pool = new QuerySessionPool(settings);
    }

    public async withSession<T>(callback: (session: QuerySession) => Promise<T>, timeout: number = 0): Promise<T> {
        return this.pool.withSession(callback, timeout);
    }

    public async withSessionRetry<T>(callback: (session: QuerySession) => Promise<T>, timeout: number = 0, maxRetries = 10): Promise<T> {
        return this.pool.withSessionRetry(callback, timeout, maxRetries);
    }

    public async destroy() {
        await this.pool.destroy();
    }
}
