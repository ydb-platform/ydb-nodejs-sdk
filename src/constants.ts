export const ENDPOINT_DISCOVERY_PERIOD = 60 * 1000; // 1 minute
export const SESSION_KEEPALIVE_PERIOD = 60 * 1000; // 1 minute

export enum Events {
    ENDPOINT_REMOVED = 'endpoint:removed',
}

export enum ResponseMetadataKeys {
    RequestId = 'x-request-id',
    ConsumedUnits = 'x-ydb-consumed-units',
    ServerHints = 'x-ydb-server-hints',
}
