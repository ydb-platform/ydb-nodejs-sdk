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
import {IClientSettings} from "../client/settings";

export default class SchemeClient extends EventEmitter {
    private schemeServices: Map<Endpoint, SchemeService>;

    constructor(private settings: IClientSettings) {
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
}
