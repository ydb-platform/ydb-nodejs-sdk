"use strict";
// Note: Explicit enumeration is used so that jest.spyOn() can replace utils.<item> with mock.  If you specify
// thru asterisk, TypeScript moves these properties to utils as unmodifiable properties
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTimeout = exports.toLong = exports.sleep = exports.pessimizable = exports.GrpcService = exports.AuthenticatedService = exports.StreamEnd = void 0;
var authenticated_service_1 = require("./authenticated-service");
Object.defineProperty(exports, "StreamEnd", { enumerable: true, get: function () { return authenticated_service_1.StreamEnd; } });
Object.defineProperty(exports, "AuthenticatedService", { enumerable: true, get: function () { return authenticated_service_1.AuthenticatedService; } });
Object.defineProperty(exports, "GrpcService", { enumerable: true, get: function () { return authenticated_service_1.GrpcService; } });
var pessimizable_1 = require("./pessimizable");
Object.defineProperty(exports, "pessimizable", { enumerable: true, get: function () { return pessimizable_1.pessimizable; } });
var sleep_1 = require("./sleep");
Object.defineProperty(exports, "sleep", { enumerable: true, get: function () { return sleep_1.sleep; } });
var to_long_1 = require("./to-long");
Object.defineProperty(exports, "toLong", { enumerable: true, get: function () { return to_long_1.toLong; } });
var with_timeout_1 = require("./with-timeout");
Object.defineProperty(exports, "withTimeout", { enumerable: true, get: function () { return with_timeout_1.withTimeout; } });
