import {EventEmitter} from "events";
import {Endpoint} from "../discovery";
import {
    DescribePathResult,
    DescribePathSettings,
    IPermissionsAction,
    ListDirectoryResult,
    ListDirectorySettings,
    MakeDirectorySettings,
    ModifyPermissionsSettings,
    RemoveDirectorySettings,
    SchemeService
} from "./scheme-service";
import {IAuthService} from "../credentials/i-auth-service";
import {ISslCredentials} from "../utils/ssl-credentials";
import {ClientOptions} from "../utils";
import DiscoveryService from "../discovery/discovery-service";
import {Logger} from "../logger/simple-logger";

interface ISchemeClientSettings {
    database: string;
    authService: IAuthService;
    sslCredentials?: ISslCredentials;
    clientOptions?: ClientOptions;
    discoveryService: DiscoveryService;
    logger: Logger;
}

export default class SchemeClient extends EventEmitter {
    private schemeServices: Map<Endpoint, SchemeService>;

    constructor(private settings: ISchemeClientSettings) {
        super();
        this.schemeServices = new Map();
    }

    private async getSchemeService(): Promise<SchemeService> {
        const endpoint = await this.settings.discoveryService.getEndpoint();
        if (!this.schemeServices.has(endpoint)) {
            const {database, authService, sslCredentials, clientOptions, logger} = this.settings;
            const service = new SchemeService(endpoint, database, authService, logger, sslCredentials, clientOptions);
            this.schemeServices.set(endpoint, service);
        }
        return this.schemeServices.get(endpoint) as SchemeService;
    }

    public async makeDirectory(path: string, settings?: MakeDirectorySettings): Promise<void> {
        const service = await this.getSchemeService();
        return await service.makeDirectory(path, settings);
    }

    public async removeDirectory(path: string, settings?: RemoveDirectorySettings): Promise<void> {
        const service = await this.getSchemeService();
        return await service.removeDirectory(path, settings);
    }

    public async listDirectory(path: string, settings?: ListDirectorySettings): Promise<ListDirectoryResult> {
        const service = await this.getSchemeService();
        return await service.listDirectory(path, settings);
    }

    public async describePath(path: string, settings?: DescribePathSettings): Promise<DescribePathResult> {
        const service = await this.getSchemeService();
        return await service.describePath(path, settings);
    }

    public async modifyPermissions(path: string, permissionActions: IPermissionsAction[], clearPermissions?: boolean, settings?: ModifyPermissionsSettings) {
        const service = await this.getSchemeService();
        return await service.modifyPermissions(path, permissionActions, clearPermissions, settings);
    }

    public async destroy() {
        return;
    }

    [Symbol.dispose]() {
        return this.destroy();
    }
}
