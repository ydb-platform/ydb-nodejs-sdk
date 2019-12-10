import _ from 'lodash';
import {Logger} from 'pino';
import EventEmitter from 'events';
import {Ydb} from "../proto/bundle";
import {BaseService, getOperationPayload} from "./utils";
import DiscoveryServiceAPI = Ydb.Discovery.V1.DiscoveryService;
import IEndpointInfo = Ydb.Discovery.IEndpointInfo;
import {IAuthService} from "./credentials";


type SuccessDiscoveryHandler = (result: Endpoint[]) => void;
type FailureDiscoveryHandler = (err: Error) => void;

const noOp = () => {};

export class Endpoint extends Ydb.Discovery.EndpointInfo {
    static HOST_RE = /^([^:]+):?(\d)*$/;

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
    }

    /*
     Update current endpoint with the attributes taken from another endpoint.
     */
    public update(_endpoint: Endpoint) {
        // do nothing for now
        return this;
    }

    public toString(): string {
        let result = this.address;
        if (this.port) {
            result += ':' + this.port;
        }
        return result;
    }
}

export default class DiscoveryService extends BaseService<DiscoveryServiceAPI> {
    private readonly endpointsPromise: Promise<void>;
    private resolveEndpoints: SuccessDiscoveryHandler = noOp;
    private rejectEndpoints: FailureDiscoveryHandler = noOp;
    private readonly periodicDiscoveryId: NodeJS.Timeout;

    private endpoints: Endpoint[] = [];
    private currentEndpointIndex: number = 0;
    private events: EventEmitter = new EventEmitter();

    // private selfLocation: string = '';

    constructor(entryPoint: string, private database: string, private discoveryPeriod: number, authService: IAuthService, private logger: Logger) {
        super(
            entryPoint,
            'Ydb.Discovery.V1.DiscoveryService',
            DiscoveryServiceAPI,
            authService
        );
        this.endpointsPromise = new Promise((resolve, reject) => {
            this.resolveEndpoints = (endpoints: Endpoint[]) => {
                this.endpoints = endpoints;
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
        const endpointsToRemove = _.differenceBy(this.endpoints, endpoints);
        const endpointsToUpdate = _.intersectionBy(this.endpoints, endpoints, getHost);

        _.forEach(endpointsToRemove, (endpoint) => this.emit('remove', endpoint));

        for (const current of endpointsToUpdate) {
            const newEndpoint =
                _.find(endpoints, (incoming) => incoming.toString() === current.toString()) as Endpoint;
            current.update(newEndpoint);
        }
        this.endpoints = _.sortBy(endpointsToUpdate.concat(endpointsToAdd), getHost);
        // reset round-robin index in case new endpoints have been discovered or existing ones have become stale
        if (endpointsToRemove.length + endpointsToAdd.length > 0) {
            this.endpoints = _.shuffle(this.endpoints);
            this.currentEndpointIndex = 0;
        }
    }

    private discoverEndpoints(database: string): Promise<Endpoint[]> {
        return this.api.listEndpoints({database})
            .then((response) => {
                const payload = getOperationPayload(response);
                const endpointsResult = Ydb.Discovery.ListEndpointsResult.decode(payload);
                // this.selfLocation = endpointsResult.selfLocation;
                const endpoints = _.map(endpointsResult.endpoints, (endpointInfo) => new Endpoint(endpointInfo, database));
                return _.sortBy(endpoints, (endpoint) => endpoint.toString());
            });
    }

    public emit(eventName: string, ...args: any[]): void {
        this.events.emit(eventName, ...args);
    }
    public on(eventName: string, callback: (...args: any[]) => void): void {
        this.events.on(eventName, callback);
    }

    public ready(timeout: number): Promise<any> {
        const timedRejection = new Promise((_resolve, reject) => {
            setTimeout(() => reject(`Failed to resolve in ${timeout}ms!`), timeout);
        });
        return Promise.race([this.endpointsPromise, timedRejection]);
    }

    private async getEndpointRR(): Promise<Endpoint> {
        await this.endpointsPromise;
        return this.endpoints[this.currentEndpointIndex++ % this.endpoints.length];
    }

    public async getEndpoint(): Promise<Endpoint> {
        return this.getEndpointRR();
    }
}
