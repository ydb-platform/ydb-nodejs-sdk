import {Ydb} from "../proto/bundle";
import {BaseService, getOperationPayload, ensureOperationSucceeded} from "./utils";
import {IAuthService} from "./credentials";
import getLogger, {Logger} from './logging';

import SchemeServiceAPI = Ydb.Scheme.V1.SchemeService;
import IOperationParams = Ydb.Operations.IOperationParams;
import ListDirectoryResult = Ydb.Scheme.ListDirectoryResult;
import DescribePathResult = Ydb.Scheme.DescribePathResult;
import IPermissionsAction = Ydb.Scheme.IPermissionsAction;
import IMakeDirectoryRequest = Ydb.Scheme.IMakeDirectoryRequest;

export default class SchemeService extends BaseService<SchemeServiceAPI> {
    private logger: Logger;

    constructor(entryPoint: string, private database: string, authService: IAuthService) {
        super(
            entryPoint,
            'Ydb.Scheme.V1.SchemeService',
            SchemeServiceAPI,
            authService
        );
        this.logger = getLogger();
    }

    prepareRequest(path: string, operationParams?: IOperationParams): IMakeDirectoryRequest {
        return {
            path: `${this.database}/${path}`,
            operationParams
        };
    }

    public async makeDirectory(path: string, operationParams?: IOperationParams): Promise<void> {
        const request = this.prepareRequest(path, operationParams);
        this.logger.debug(`Making directory ${request.path}`);
        ensureOperationSucceeded(await this.api.makeDirectory(request));
    }

    public async removeDirectory(path: string, operationParams?: IOperationParams): Promise<void> {
        const request = this.prepareRequest(path, operationParams);
        this.logger.debug(`Removing directory ${request.path}`);
        ensureOperationSucceeded(await this.api.removeDirectory(request));
    }

    public async listDirectory(path: string, operationParams?: IOperationParams): Promise<ListDirectoryResult> {
        const request = this.prepareRequest(path, operationParams);
        this.logger.debug(`Listing directory ${request.path} contents`);
        const response = await this.api.listDirectory(request);
        const payload = getOperationPayload(response);
        return ListDirectoryResult.decode(payload);
    }

    public async describePath(path: string, operationParams?: IOperationParams): Promise<DescribePathResult> {
        const request = this.prepareRequest(path, operationParams);
        this.logger.debug(`Describing path ${request.path}`);
        const response = await this.api.describePath(request);
        const payload = getOperationPayload(response);
        return DescribePathResult.decode(payload);
    }

    public async modifyPermissions(path: string, permissionActions: IPermissionsAction[], clearPermissions?: boolean, operationParams?: IOperationParams) {
        const request = {
            ...this.prepareRequest(path, operationParams),
            actions: permissionActions,
            clearPermissions
        };
        this.logger.debug(`Modifying permissions on path ${request.path} to ${JSON.stringify(permissionActions, null, 2)}`);
        ensureOperationSucceeded(await this.api.modifyPermissions(request));
    }

    public async destroy() {
        return;
    }
}
