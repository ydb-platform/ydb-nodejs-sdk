import {Ydb} from 'ydb-sdk-proto';
import SchemeServiceAPI = Ydb.Scheme.V1.SchemeService;
export import ListDirectoryResult = Ydb.Scheme.ListDirectoryResult;
export import DescribePathResult = Ydb.Scheme.DescribePathResult;
export import IPermissionsAction = Ydb.Scheme.IPermissionsAction;
import IMakeDirectoryRequest = Ydb.Scheme.IMakeDirectoryRequest;
import IPermissions = Ydb.Scheme.IPermissions;
import {OperationParamsSettings} from "../table";
import {AuthenticatedService, ClientOptions, pessimizable} from "../utils";
import {Endpoint} from "../discovery";
import {IAuthService} from "../credentials/i-auth-service";
import {ISslCredentials} from "../utils/ssl-credentials";
import {retryable} from "../retries_obsoleted";
import {ensureOperationSucceeded, getOperationPayload} from "../utils/process-ydb-operation-result";
import {Logger} from "../logger/simple-logger";

function preparePermissions(action?: IPermissions | null) {
    if (action && action.permissionNames) {
        return {
            ...action,
            permissionNames: action.permissionNames.map(
                (name) => name.startsWith('ydb.generic.') ? name : `ydb.generic.${name}`
            )
        };
    }
    return action;
}

function preparePermissionAction(action: IPermissionsAction) {
    const {grant, revoke, set, ...rest} = action;
    return {
        ...rest,
        grant: preparePermissions(grant),
        revoke: preparePermissions(revoke),
        set: preparePermissions(set),
    }
}

export class MakeDirectorySettings extends OperationParamsSettings {
}

export class RemoveDirectorySettings extends OperationParamsSettings {
}

export class ListDirectorySettings extends OperationParamsSettings {
}

export class DescribePathSettings extends OperationParamsSettings {
}

export class ModifyPermissionsSettings extends OperationParamsSettings {
}

export class SchemeService extends AuthenticatedService<SchemeServiceAPI> {
    private logger: Logger;
    private readonly database: string;
    public endpoint: Endpoint;

    constructor(endpoint: Endpoint, database: string, authService: IAuthService, logger: Logger, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions) {
        const host = endpoint.toString();
        super(
            host,
            database,
            'Ydb.Scheme.V1.SchemeService',
            SchemeServiceAPI,
            authService,
            sslCredentials,
            clientOptions,
        );
        this.endpoint = endpoint;
        this.database = database;
        this.logger = logger;
    }

    prepareRequest(path: string, settings?: OperationParamsSettings): IMakeDirectoryRequest {
        return {
            path: `${this.database}/${path}`,
            operationParams: settings?.operationParams,
        };
    }

    @retryable()
    @pessimizable
    public async makeDirectory(path: string, settings?: MakeDirectorySettings): Promise<void> {
        const request = this.prepareRequest(path, settings);
        this.logger.debug(`Making directory ${request.path}`);
        ensureOperationSucceeded(await this.api.makeDirectory(request));
    }

    @retryable()
    @pessimizable
    public async removeDirectory(path: string, settings?: RemoveDirectorySettings): Promise<void> {
        const request = this.prepareRequest(path, settings);
        this.logger.debug(`Removing directory ${request.path}`);
        ensureOperationSucceeded(await this.api.removeDirectory(request));
    }

    @retryable()
    @pessimizable
    public async listDirectory(path: string, settings?: ListDirectorySettings): Promise<ListDirectoryResult> {
        const request = this.prepareRequest(path, settings);
        this.logger.debug(`Listing directory ${request.path} contents`);
        const response = await this.api.listDirectory(request);
        const payload = getOperationPayload(response);
        return ListDirectoryResult.decode(payload);
    }

    @retryable()
    @pessimizable
    public async describePath(path: string, settings?: DescribePathSettings): Promise<DescribePathResult> {
        const request = this.prepareRequest(path, settings);
        this.logger.debug(`Describing path ${request.path}`);
        const response = await this.api.describePath(request);
        const payload = getOperationPayload(response);
        return DescribePathResult.decode(payload);
    }

    @retryable()
    @pessimizable
    public async modifyPermissions(path: string, permissionActions: IPermissionsAction[], clearPermissions?: boolean, settings?: ModifyPermissionsSettings) {
        const request = {
            ...this.prepareRequest(path, settings),
            actions: permissionActions.map(preparePermissionAction),
            clearPermissions
        };
        this.logger.debug(`Modifying permissions on path ${request.path} to ${JSON.stringify(permissionActions, null, 2)}`);
        ensureOperationSucceeded(await this.api.modifyPermissions(request));
    }
}
