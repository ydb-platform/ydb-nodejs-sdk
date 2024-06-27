"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Endpoint = void 0;
var luxon_1 = require("luxon");
var ydb_sdk_proto_1 = require("ydb-sdk-proto");
var Endpoint = /** @class */ (function (_super) {
    __extends(Endpoint, _super);
    function Endpoint(properties, database) {
        var _this = _super.call(this, properties) || this;
        _this.database = database;
        _this.pessimizedAt = null;
        return _this;
    }
    Endpoint.fromString = function (host) {
        var match = Endpoint.HOST_RE.exec(host);
        if (match) {
            var info = {
                address: match[1]
            };
            if (match[2]) {
                info.port = Number(match[2]);
            }
            return this.create(info);
        }
        throw new Error("Provided incorrect host \"".concat(host, "\""));
    };
    /*
     Update current endpoint with the attributes taken from another endpoint.
     */
    Endpoint.prototype.update = function (_endpoint) {
        // do nothing for now
        return this;
    };
    Object.defineProperty(Endpoint.prototype, "pessimized", {
        get: function () {
            if (this.pessimizedAt) {
                return luxon_1.DateTime.utc().diff(this.pessimizedAt).valueOf() < Endpoint.PESSIMIZATION_WEAR_OFF_PERIOD;
            }
            return false;
        },
        enumerable: false,
        configurable: true
    });
    Endpoint.prototype.pessimize = function () {
        this.pessimizedAt = luxon_1.DateTime.utc();
    };
    Endpoint.prototype.toString = function () {
        var result = this.address;
        if (this.port) {
            result += ':' + this.port;
        }
        return result;
    };
    Endpoint.HOST_RE = /^([^:]+):?(\d)*$/;
    Endpoint.PESSIMIZATION_WEAR_OFF_PERIOD = 60 * 1000;
    return Endpoint;
}(ydb_sdk_proto_1.Ydb.Discovery.EndpointInfo));
exports.Endpoint = Endpoint;
