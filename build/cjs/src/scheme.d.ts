import { Ydb } from "ydb-sdk-proto";
import { ClientOptions } from "./utils";
import { IAuthService } from "./credentials";
import { Logger } from './logging';
import DiscoveryService from './discovery';
import { ISslCredentials } from './ssl-credentials';
import { OperationParamsSettings } from './table';
import ListDirectoryResult = Ydb.Scheme.ListDirectoryResult;
import DescribePathResult = Ydb.Scheme.DescribePathResult;
import IPermissionsAction = Ydb.Scheme.IPermissionsAction;
import { util } from "protobufjs";
import EventEmitter = util.EventEmitter;
export declare class MakeDirectorySettings extends OperationParamsSettings {
}
export declare class RemoveDirectorySettings extends OperationParamsSettings {
}
export declare class ListDirectorySettings extends OperationParamsSettings {
}
export declare class DescribePathSettings extends OperationParamsSettings {
}
export declare class ModifyPermissionsSettings extends OperationParamsSettings {
}
interface ISchemeClientSettings {
    database: string;
    authService: IAuthService;
    sslCredentials?: ISslCredentials;
    clientOptions?: ClientOptions;
    discoveryService: DiscoveryService;
    logger: Logger;
}
export default class SchemeClient extends EventEmitter {
    private settings;
    private schemeServices;
    constructor(settings: ISchemeClientSettings);
    private getSchemeService;
    makeDirectory(path: string, settings?: MakeDirectorySettings): Promise<void>;
    removeDirectory(path: string, settings?: RemoveDirectorySettings): Promise<void>;
    listDirectory(path: string, settings?: ListDirectorySettings): Promise<ListDirectoryResult>;
    describePath(path: string, settings?: DescribePathSettings): Promise<DescribePathResult>;
    modifyPermissions(path: string, permissionActions: IPermissionsAction[], clearPermissions?: boolean, settings?: ModifyPermissionsSettings): Promise<void>;
    destroy(): Promise<void>;
}
export {};
