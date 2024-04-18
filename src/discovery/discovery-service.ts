import {Ydb} from "ydb-sdk-proto";
import DiscoveryServiceAPI = Ydb.Discovery.V1.DiscoveryService;
import {Endpoint, SuccessDiscoveryHandler} from "./endpoint";
import EventEmitter from "events";
import {Logger} from "../logger/simple-logger";
import _ from "lodash";
import {Events} from "../constants";
import {retryable} from "../retries/retryable";
import {ISslCredentials} from "../utils/ssl-credentials";
import {getOperationPayload} from "../utils/process-ydb-operation-result";
import {AuthenticatedService} from "../utils/authenticated-service";
import {withTimeout} from "../utils/with-timeout";
import {IAuthService} from "../credentials/i-auth-service";
import {HasLogger} from "../logger/has-logger";
import {ensureContext} from "../context/EnsureContext";
import {Context} from "../context/Context";
import {HasObjectContext} from "../context/has-object-context";

type FailureDiscoveryHandler = (err: Error) => void;
const noOp = () => {
};

interface IDiscoverySettings {
    ctx: Context,
    endpoint: string;
    database: string;
    discoveryPeriod: number;
    authService: IAuthService;
    logger: Logger;
    sslCredentials?: ISslCredentials,
}

export default class DiscoveryService extends AuthenticatedService<DiscoveryServiceAPI> implements HasLogger, HasObjectContext {
    public readonly ctx: Context;
    private readonly database: string;
    private readonly discoveryPeriod: number;
    private readonly endpointsPromise: Promise<void>;
    private resolveEndpoints: SuccessDiscoveryHandler = noOp;
    private rejectEndpoints: FailureDiscoveryHandler = noOp;
    private readonly periodicDiscoveryId: NodeJS.Timeout;

    private endpoints: Endpoint[] = [];
    private currentEndpointIndex: number = 0;
    private events: EventEmitter = new EventEmitter();
    public readonly logger: Logger;

    // private selfLocation: string = '';

    constructor(settings: IDiscoverySettings) {
        super(
            settings.endpoint,
            settings.database,
            'Ydb.Discovery.V1.DiscoveryService',
            DiscoveryServiceAPI,
            settings.authService,
            settings.sslCredentials,
        );
        this.ctx = settings.ctx;
        this.database = settings.database;
        this.discoveryPeriod = settings.discoveryPeriod;
        this.logger = settings.logger;
        this.endpointsPromise = new Promise((resolve, reject) => {
            this.resolveEndpoints = (endpoints: Endpoint[]) => {
                this.updateEndpoints(this.ctx, endpoints);
                resolve();
            };
            this.rejectEndpoints = reject;
        });
        this.periodicDiscoveryId = this.init(this.ctx);
    }

    // @ts-ignore
    public destroy(): void;
    public destroy(ctx: Context): void;
    @ensureContext(true)
    public destroy(_ctx: Context): void {
        clearInterval(this.periodicDiscoveryId);
    }

    private init(ctx: Context): NodeJS.Timeout {
        this.discoverEndpoints(ctx, this.database)
            .then(this.resolveEndpoints)
            .catch(this.rejectEndpoints);

        return setInterval(async () => {
            await this.endpointsPromise;
            try {
                const endpoints = await this.discoverEndpoints(ctx, this.database);
                this.updateEndpoints(ctx, endpoints);
            } catch (error) {
                this.logger.error(error as object);
            }
        }, this.discoveryPeriod);
    }

    private updateEndpoints(_ctx: Context, endpoints: Endpoint[]): void {
        const getHost = (endpoint: Endpoint) => endpoint.toString();
        const endpointsToAdd = _.differenceBy(endpoints, this.endpoints, getHost);
        const endpointsToRemove = _.differenceBy(this.endpoints, endpoints, getHost);
        const endpointsToUpdate = _.intersectionBy(this.endpoints, endpoints, getHost);
        this.logger.trace('Current endpoints %o', this.endpoints);
        this.logger.trace('Incoming endpoints %o', endpoints);
        this.logger.trace('Endpoints to add %o', endpointsToAdd);
        this.logger.trace('Endpoints to remove %o', endpointsToRemove);
        this.logger.trace('Endpoints to update %o', endpointsToUpdate);

        _.forEach(endpointsToRemove, (endpoint) => this.emit(Events.ENDPOINT_REMOVED, endpoint));

        for (const current of endpointsToUpdate) {
            const newEndpoint =
                _.find(endpoints, (incoming) => incoming.toString() === current.toString()) as Endpoint;
            current.update(newEndpoint);
        }
        // endpointsToUpdate ordering is the same as this.endpoints, according to _.intersectionBy docs
        this.endpoints = endpointsToUpdate.concat(endpointsToAdd);
        // reset round-robin index in case new endpoints have been discovered or existing ones have become stale
        if (endpointsToRemove.length + endpointsToAdd.length > 0) {
            this.endpoints = _.shuffle(this.endpoints);
            this.currentEndpointIndex = 0;
        }
    }

    @retryable()
    private async discoverEndpoints(_ctx: Context, database: string): Promise<Endpoint[]> {
        const response = await this.api.listEndpoints({database});
        const payload = getOperationPayload(response);
        const endpointsResult = Ydb.Discovery.ListEndpointsResult.decode(payload);
        // this.selfLocation = endpointsResult.selfLocation;
        return _.map(endpointsResult.endpoints, (endpointInfo) => new Endpoint(endpointInfo, database));
    }

    public emit(eventName: string, ...args: any[]): void {
        this.events.emit(eventName, ...args);
    }

    public on(eventName: string, callback: (...args: any[]) => void): void {
        this.events.on(eventName, callback);
    }

    // @ts-ignore
    public ready(timeout: number): Promise<void>;
    public ready(ctx: Context, timeout: number): Promise<void>;
    @ensureContext(true)
    public ready(_ctx: Context, timeout: number): Promise<void> {
        return withTimeout<void>(this.endpointsPromise, timeout);
    }

    private async getEndpointRR(_ctx: Context): Promise<Endpoint> {
        await this.endpointsPromise;
        const endpoint = this.endpoints[this.currentEndpointIndex++ % this.endpoints.length];
        this.logger.trace('getEndpointRR result: %o', endpoint);
        return endpoint;
    }

    // @ts-ignore
    public async getEndpoint(): Promise<Endpoint>;
    public async getEndpoint(ctx: Context): Promise<Endpoint>;
    @ensureContext(true)
    public async getEndpoint(ctx: Context): Promise<Endpoint> {
        let endpoint = await this.getEndpointRR(ctx);
        let counter = 0;
        while (endpoint.pessimized && counter < this.endpoints.length) {
            endpoint = await this.getEndpointRR(ctx);
            counter++;
        }
        if (counter === this.endpoints.length) {
            this.logger.debug('All endpoints are pessimized, returning original endpoint');
        }
        return endpoint;
    }
}
