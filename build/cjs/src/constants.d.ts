export declare const ENDPOINT_DISCOVERY_PERIOD: number;
export declare const SESSION_KEEPALIVE_PERIOD: number;
export declare enum Events {
    ENDPOINT_REMOVED = "endpoint:removed"
}
export declare enum ResponseMetadataKeys {
    RequestId = "x-request-id",
    ConsumedUnits = "x-ydb-consumed-units",
    ServerHints = "x-ydb-server-hints"
}
