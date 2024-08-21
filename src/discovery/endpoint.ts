import {DateTime} from "luxon";
import {Ydb} from "ydb-sdk-proto";
import IEndpointInfo = Ydb.Discovery.IEndpointInfo;

export type SuccessDiscoveryHandler = (result: Endpoint[]) => void;


// TODO: Keep node ID
// TODO: Keep lazy GRPC connection
// TODO: ? drop grpc connection on end
export class Endpoint extends Ydb.Discovery.EndpointInfo {
    static HOST_RE = /^([^:]+):?(\d)*$/;
    static PESSIMIZATION_WEAR_OFF_PERIOD = 60 * 1000; //  TODO: wher off once new list of nodes was received

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
    public update(_endpoint: Endpoint) { // TODO: ???
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
