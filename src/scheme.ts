import {Ydb} from "../proto/bundle";
import {AuthenticatedService, getOperationPayload, ensureOperationSucceeded, pessimizable} from "./utils";
import {IAuthService} from "./credentials";
import getLogger, {Logger} from './logging';
import {Endpoint} from './discovery';
import {retryable} from "./retries";
import Driver from "./driver";

import SchemeServiceAPI = Ydb.Scheme.V1.SchemeService;
import IOperationParams = Ydb.Operations.IOperationParams;
import ListDirectoryResult = Ydb.Scheme.ListDirectoryResult;
import DescribePathResult = Ydb.Scheme.DescribePathResult;
import IPermissionsAction = Ydb.Scheme.IPermissionsAction;
import IMakeDirectoryRequest = Ydb.Scheme.IMakeDirectoryRequest;
import IPermissions = Ydb.Scheme.IPermissions;
import {util} from "protobufjs";
import EventEmitter = util.EventEmitter;


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

export default class SchemeClient extends EventEmitter {
    private schemeServices: Map<Endpoint, SchemeService>;

    constructor(private driver: Driver) {
        super();
        this.schemeServices = new Map();
    }

    private async getSchemeService(): Promise<SchemeService> {
        const endpoint = await this.driver.getEndpoint();
        if (!this.schemeServices.has(endpoint)) {
            const service = new SchemeService(endpoint, this.driver.database, this.driver.authService);
            this.schemeServices.set(endpoint, service);
        }
        return this.schemeServices.get(endpoint) as SchemeService;
    }

    public async makeDirectory(path: string, operationParams?: IOperationParams): Promise<void> {
        const service = await this.getSchemeService();
        return await service.makeDirectory(path, operationParams);
    }

    public async removeDirectory(path: string, operationParams?: IOperationParams): Promise<void> {
        const service = await this.getSchemeService();
        return await service.removeDirectory(path, operationParams);
    }

    public async listDirectory(path: string, operationParams?: IOperationParams): Promise<ListDirectoryResult> {
        const service = await this.getSchemeService();
        return await service.listDirectory(path, operationParams);
    }

    public async describePath(path: string, operationParams?: IOperationParams): Promise<DescribePathResult> {
        const service = await this.getSchemeService();
        return await service.describePath(path, operationParams);
    }

    public async modifyPermissions(path: string, permissionActions: IPermissionsAction[], clearPermissions?: boolean, operationParams?: IOperationParams) {
        const service = await this.getSchemeService();
        return await service.modifyPermissions(path, permissionActions, clearPermissions, operationParams);
    }

    public async destroy() {
        return;
    }
}

class SchemeService extends AuthenticatedService<SchemeServiceAPI> {
    private logger: Logger;
    private readonly database: string;
    public endpoint: Endpoint;

    constructor(endpoint: Endpoint, database: string, authService: IAuthService) {
        const host = endpoint.toString();
        super(
            host,
            'Ydb.Scheme.V1.SchemeService',
            SchemeServiceAPI,
            authService
        );
        this.endpoint = endpoint;
        this.database = database;
        this.logger = getLogger();
    }

    prepareRequest(path: string, operationParams?: IOperationParams): IMakeDirectoryRequest {
        return {
            path: `${this.database}/${path}`,
            operationParams
        };
    }

    @retryable()
    @pessimizable
    public async makeDirectory(path: string, operationParams?: IOperationParams): Promise<void> {
        const request = this.prepareRequest(path, operationParams);
        this.logger.debug(`Making directory ${request.path}`);
        ensureOperationSucceeded(await this.api.makeDirectory(request));
    }

    @retryable()
    @pessimizable
    public async removeDirectory(path: string, operationParams?: IOperationParams): Promise<void> {
        const request = this.prepareRequest(path, operationParams);
        this.logger.debug(`Removing directory ${request.path}`);
        ensureOperationSucceeded(await this.api.removeDirectory(request));
    }

    @retryable()
    @pessimizable
    public async listDirectory(path: string, operationParams?: IOperationParams): Promise<ListDirectoryResult> {
        const request = this.prepareRequest(path, operationParams);
        this.logger.debug(`Listing directory ${request.path} contents`);
        const response = await this.api.listDirectory(request);
        const payload = getOperationPayload(response);
        return ListDirectoryResult.decode(payload);
    }

    @retryable()
    @pessimizable
    public async describePath(path: string, operationParams?: IOperationParams): Promise<DescribePathResult> {
        const request = this.prepareRequest(path, operationParams);
        this.logger.debug(`Describing path ${request.path}`);
        const response = await this.api.describePath(request);
        const payload = getOperationPayload(response);
        return DescribePathResult.decode(payload);
    }

    @retryable()
    @pessimizable
    public async modifyPermissions(path: string, permissionActions: IPermissionsAction[], clearPermissions?: boolean, operationParams?: IOperationParams) {
        const request = {
            ...this.prepareRequest(path, operationParams),
            actions: permissionActions.map(preparePermissionAction),
            clearPermissions
        };
        this.logger.debug(`Modifying permissions on path ${request.path} to ${JSON.stringify(permissionActions, null, 2)}`);
        ensureOperationSucceeded(await this.api.modifyPermissions(request));
    }
}
