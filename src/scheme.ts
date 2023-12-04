// eslint-disable-next-line max-classes-per-file
import { Ydb } from 'ydb-sdk-proto';
import { util } from 'protobufjs';
import EventEmitter = util.EventEmitter;
import {
    AuthenticatedService,
    getOperationPayload,
    ensureOperationSucceeded,
    pessimizable,
    ClientOptions,
} from './utils';
import { IAuthService } from './credentials';
// noinspection ES6PreferShortImport
import { Logger } from './logging';
import DiscoveryService, { Endpoint } from './discovery';
import { retryable } from './retries';
import { ISslCredentials } from './ssl-credentials';
import { OperationParamsSettings } from './table';

import SchemeServiceAPI = Ydb.Scheme.V1.SchemeService;
import ListDirectoryResult = Ydb.Scheme.ListDirectoryResult;
import DescribePathResult = Ydb.Scheme.DescribePathResult;
import IPermissionsAction = Ydb.Scheme.IPermissionsAction;
import IMakeDirectoryRequest = Ydb.Scheme.IMakeDirectoryRequest;
import IPermissions = Ydb.Scheme.IPermissions;

const preparePermissions = (action?: IPermissions | null) => {
    if (action?.permissionNames) {
        return {
            ...action,
            permissionNames: action.permissionNames.map(
                (name) => (name.startsWith('ydb.generic.') ? name : `ydb.generic.${name}`),
            ),
        };
    }

    return action;
};

const preparePermissionAction = (action: IPermissionsAction) => {
    const {
        grant, revoke, set, ...rest
    } = action;

    return {
        ...rest,
        grant: preparePermissions(grant),
        revoke: preparePermissions(revoke),
        set: preparePermissions(set),
    };
};

export class MakeDirectorySettings extends OperationParamsSettings {}

export class RemoveDirectorySettings extends OperationParamsSettings {}

export class ListDirectorySettings extends OperationParamsSettings {}

export class DescribePathSettings extends OperationParamsSettings {}

export class ModifyPermissionsSettings extends OperationParamsSettings {}

interface ISchemeClientSettings {
    database: string;
    authService: IAuthService;
    sslCredentials?: ISslCredentials;
    clientOptions?: ClientOptions;
    discoveryService: DiscoveryService;
    logger: Logger;
}

// eslint-disable-next-line unicorn/prefer-event-target
export default class SchemeClient extends EventEmitter {
    private schemeServices: Map<Endpoint, SchemeService>;

    constructor(private settings: ISchemeClientSettings) {
        super();
        this.schemeServices = new Map();
    }

    private async getSchemeService(): Promise<SchemeService> {
        const endpoint = await this.settings.discoveryService.getEndpoint();

        if (!this.schemeServices.has(endpoint)) {
            const {
                database, authService, sslCredentials, clientOptions, logger,
            } = this.settings;
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            const service = new SchemeService(endpoint, database, authService, logger, sslCredentials, clientOptions);

            this.schemeServices.set(endpoint, service);
        }

        return this.schemeServices.get(endpoint) as SchemeService;
    }

    public async makeDirectory(path: string, settings?: MakeDirectorySettings): Promise<void> {
        const service = await this.getSchemeService();

        return service.makeDirectory(path, settings);
    }

    public async removeDirectory(path: string, settings?: RemoveDirectorySettings): Promise<void> {
        const service = await this.getSchemeService();

        return service.removeDirectory(path, settings);
    }

    public async listDirectory(path: string, settings?: ListDirectorySettings): Promise<ListDirectoryResult> {
        const service = await this.getSchemeService();

        return service.listDirectory(path, settings);
    }

    public async describePath(path: string, settings?: DescribePathSettings): Promise<DescribePathResult> {
        const service = await this.getSchemeService();

        return service.describePath(path, settings);
    }

    // eslint-disable-next-line max-len
    public async modifyPermissions(path: string, permissionActions: IPermissionsAction[], clearPermissions?: boolean, settings?: ModifyPermissionsSettings) {
        const service = await this.getSchemeService();

        return service.modifyPermissions(path, permissionActions, clearPermissions, settings);
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async destroy() {}
}

class SchemeService extends AuthenticatedService<SchemeServiceAPI> {
    private logger: Logger;
    private readonly database: string;
    public endpoint: Endpoint;

    // eslint-disable-next-line max-len
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
    // eslint-disable-next-line max-len
    public async modifyPermissions(path: string, permissionActions: IPermissionsAction[], clearPermissions?: boolean, settings?: ModifyPermissionsSettings) {
        const request = {
            ...this.prepareRequest(path, settings),
            actions: permissionActions.map((element) => preparePermissionAction(element)),
            clearPermissions,
        };

        this.logger.debug(`Modifying permissions on path ${request.path} to ${JSON.stringify(permissionActions, null, 2)}`);
        ensureOperationSucceeded(await this.api.modifyPermissions(request));
    }
}
