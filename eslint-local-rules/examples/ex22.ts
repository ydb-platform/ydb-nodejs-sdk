/* eslint local-rules/context: "error" */

export class SessionService extends AuthenticatedService<TableService> {
    // public endpoint: Endpoint;
    // private readonly logger: Logger;

    // eslint-disable-next-line max-len
    constructor(endpoint: Endpoint, database: string, authService: IAuthService, logger: Logger, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions) {
        const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:SessionService.constructor', logger);
        const host = ctx.doSync(() => endpoint.toString());
        //
        // super(host, database, 'Ydb.Table.V1.TableService', TableService, authService, sslCredentials, clientOptions);
        // this.endpoint = endpoint;
        // this.logger = logger;
    }

    // @retryable()
    // @pessimizable
    // async create(): Promise<Session> {
    //     // const ctx = ContextWithLogger.getSafe('ydb-nodejs-sdk:SessionService.create', this);
    //     // const response = await ctx.do(() => this.api.createSession(CreateSessionRequest.create()));
    //     // const payload = ctx.doSync(() => getOperationPayload(response));
    //     // const { sessionId } = ctx.doSync(() => CreateSessionResult.decode(payload));
    //
    //     // eslint-disable-next-line @typescript-eslint/no-use-before-define
    //     return new Session(this.api, this.endpoint, sessionId, ctx.logger, ctx.doSync(() => this.getResponseMetadata.bind(this)));
    // }
}
