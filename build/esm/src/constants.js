"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseMetadataKeys = exports.Events = exports.SESSION_KEEPALIVE_PERIOD = exports.ENDPOINT_DISCOVERY_PERIOD = void 0;
exports.ENDPOINT_DISCOVERY_PERIOD = 60 * 1000; // 1 minute
exports.SESSION_KEEPALIVE_PERIOD = 60 * 1000; // 1 minute
var Events;
(function (Events) {
    Events["ENDPOINT_REMOVED"] = "endpoint:removed";
})(Events = exports.Events || (exports.Events = {}));
var ResponseMetadataKeys;
(function (ResponseMetadataKeys) {
    ResponseMetadataKeys["RequestId"] = "x-request-id";
    ResponseMetadataKeys["ConsumedUnits"] = "x-ydb-consumed-units";
    ResponseMetadataKeys["ServerHints"] = "x-ydb-server-hints";
})(ResponseMetadataKeys = exports.ResponseMetadataKeys || (exports.ResponseMetadataKeys = {}));
