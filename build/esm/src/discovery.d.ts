import { Ydb } from "ydb-sdk-proto";
import { AuthenticatedService } from "./utils";
import { IAuthService } from "./credentials";
import { Logger } from './logging';
import DiscoveryServiceAPI = Ydb.Discovery.V1.DiscoveryService;
import IEndpointInfo = Ydb.Discovery.IEndpointInfo;
import { ISslCredentials } from './ssl-credentials';
export declare class Endpoint extends Ydb.Discovery.EndpointInfo {
    readonly database: string;
    static HOST_RE: RegExp;
    static PESSIMIZATION_WEAR_OFF_PERIOD: number;
    private pessimizedAt;
    static fromString(host: string): Ydb.Discovery.EndpointInfo;
    constructor(properties: IEndpointInfo, database: string);
    update(_endpoint: Endpoint): this;
    get pessimized(): boolean;
    pessimize(): void;
    toString(): string;
}
interface IDiscoverySettings {
    endpoint: string;
    database: string;
    discoveryPeriod: number;
    authService: IAuthService;
    logger: Logger;
    sslCredentials?: ISslCredentials;
}
export default class DiscoveryService extends AuthenticatedService<DiscoveryServiceAPI> {
    private readonly database;
    private readonly discoveryPeriod;
    private readonly endpointsPromise;
    private resolveEndpoints;
    private rejectEndpoints;
    private readonly periodicDiscoveryId;
    private endpoints;
    private currentEndpointIndex;
    private events;
    private logger;
    constructor(settings: IDiscoverySettings);
    destroy(): void;
    private init;
    private updateEndpoints;
    private discoverEndpoints;
    emit(eventName: string, ...args: any[]): void;
    on(eventName: string, callback: (...args: any[]) => void): void;
    ready(timeout: number): Promise<void>;
    private getEndpointRR;
    getEndpoint(): Promise<Endpoint>;
}
export {};
