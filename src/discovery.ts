import _ from 'lodash';
import EventEmitter from 'events';
import {DateTime} from 'luxon';
import {Ydb} from "ydb-sdk-proto";
import {AuthenticatedService, getOperationPayload, withTimeout} from "./utils";
import {IAuthService} from "./credentials";
import {retryable} from "./retries";
import getLogger, {Logger} from './logging';
import DiscoveryServiceAPI = Ydb.Discovery.V1.DiscoveryService;
import IEndpointInfo = Ydb.Discovery.IEndpointInfo;
import {Events} from "./constants";


type SuccessDiscoveryHandler = (result: Endpoint[]) => void;
type FailureDiscoveryHandler = (err: Error) => void;

const noOp = () => {};

export class Endpoint extends Ydb.Discovery.EndpointInfo {
    static HOST_RE = /^([^:]+):?(\d)*$/;
    static PESSIMIZATION_WEAR_OFF_PERIOD = 60 * 1000;

    private pessimizedAt: DateTime | null;

    static fromString(host: string) {
        const match = Endpoint.HOST_RE.exec(host);
        if (match) {
            const info: Ydb.Discovery.IEndpointInfo = {
                address: match[1]
            };
            if (match[2]) {
                info.port = Number(match[2]);
            }
            return this.create(info);
        }
        throw new Error(`Provided incorrect host "${host}"`);
    }

    constructor(properties: IEndpointInfo, public readonly database: string) {
        super(properties);
        this.pessimizedAt = null;
    }

    /*
     Update current endpoint with the attributes taken from another endpoint.
     */
    public update(_endpoint: Endpoint) {
        // do nothing for now
        return this;
    }

    public get pessimized(): boolean {
        if (this.pessimizedAt) {
            return DateTime.utc().diff(this.pessimizedAt).valueOf() < Endpoint.PESSIMIZATION_WEAR_OFF_PERIOD;
        }
        return false;
    }

    public pessimize() {
        this.pessimizedAt = DateTime.utc();
    }

    public toString(): string {
        let result = this.address;
        if (this.port) {
            result += ':' + this.port;
        }
        return result;
    }
}

export default class DiscoveryService extends AuthenticatedService<DiscoveryServiceAPI> {
    private readonly endpointsPromise: Promise<void>;
    private resolveEndpoints: SuccessDiscoveryHandler = noOp;
    private rejectEndpoints: FailureDiscoveryHandler = noOp;
    private readonly periodicDiscoveryId: NodeJS.Timeout;

    private endpoints: Endpoint[] = [];
    private currentEndpointIndex: number = 0;
    private events: EventEmitter = new EventEmitter();
    private logger: Logger;

    // private selfLocation: string = '';

    constructor(endpoint: string, private database: string, private discoveryPeriod: number, authService: IAuthService) {
        super(
            endpoint,
            'Ydb.Discovery.V1.DiscoveryService',
            DiscoveryServiceAPI,
            authService
        );
        this.logger = getLogger();
        this.endpointsPromise = new Promise((resolve, reject) => {
            this.resolveEndpoints = (endpoints: Endpoint[]) => {
                this.updateEndpoints(endpoints);
                resolve();
            };
            this.rejectEndpoints = reject;
        });
        this.periodicDiscoveryId = this.init();
    }

    public destroy(): void {
        clearInterval(this.periodicDiscoveryId);
    }

    private init(): NodeJS.Timeout {
        this.discoverEndpoints(this.database)
            .then(this.resolveEndpoints)
            .catch(this.rejectEndpoints);

        return setInterval(async () => {
            await this.endpointsPromise;
            try {
                const endpoints = await this.discoverEndpoints(this.database);
                this.updateEndpoints(endpoints);
            } catch (error) {
                this.logger.error(error);
            }
        }, this.discoveryPeriod);
    }

    private updateEndpoints(endpoints: Endpoint[]): void {
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
    private async discoverEndpoints(database: string): Promise<Endpoint[]> {
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

    public ready(timeout: number): Promise<void> {
        return withTimeout<void>(this.endpointsPromise, timeout);
    }

    private async getEndpointRR(): Promise<Endpoint> {
        await this.endpointsPromise;
        const endpoint = this.endpoints[this.currentEndpointIndex++ % this.endpoints.length];
        this.logger.trace('getEndpointRR result: %o', endpoint);
        return endpoint;
    }

    public async getEndpoint(): Promise<Endpoint> {
        let endpoint = await this.getEndpointRR();
        let counter = 0;
        while (endpoint.pessimized && counter < this.endpoints.length) {
            endpoint = await this.getEndpointRR();
            counter++;
        }
        if (counter === this.endpoints.length) {
            this.logger.debug('All endpoints are pessimized, returning original endpoint');
        }
        return endpoint;
    }
}
