import { Ydb } from 'ydb-sdk-proto';
import {
    AuthenticatedService, ClientOptions, getOperationPayload, pessimizable,
} from '../utils';
import { Endpoint } from '../discovery';
import { Logger } from '../utils/simple-logger';
import { IAuthService } from '../credentials';
import { ISslCredentials } from '../ssl-credentials';
import { retryable } from '../retries';
import { Session } from './session';

import TableService = Ydb.Table.V1.TableService;
import CreateSessionRequest = Ydb.Table.CreateSessionRequest;
import CreateSessionResult = Ydb.Table.CreateSessionResult;

export class SessionService extends AuthenticatedService<TableService> {
    public endpoint: Endpoint;
    private readonly logger: Logger;

    constructor(endpoint: Endpoint, database: string, authService: IAuthService, logger: Logger, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions) {
        const host = endpoint.toString();

        super(host, database, 'Ydb.Table.V1.TableService', TableService, authService, sslCredentials, clientOptions);
        this.endpoint = endpoint;
        this.logger = logger;
    }

    @retryable()
    @pessimizable
    async create(): Promise<Session> {
        const response = await this.api.createSession(CreateSessionRequest.create());
        const payload = getOperationPayload(response);
        const { sessionId } = CreateSessionResult.decode(payload);

        return new Session(this.api, this.endpoint, sessionId, this.logger, this.getResponseMetadata.bind(this));
    }
}
