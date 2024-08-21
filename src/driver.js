"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var constants_1 = require("./constants");
var errors_1 = require("./errors");
var ssl_credentials_1 = require("./utils/ssl-credentials");
var discovery_service_1 = require("./discovery/discovery-service");
var table_1 = require("./table");
var scheme_client_1 = require("./schema/scheme-client");
var parse_connection_string_1 = require("./utils/parse-connection-string");
var query_1 = require("./query");
var get_default_logger_1 = require("./logger/get-default-logger");
var Driver = /** @class */ (function () {
    function Driver(settings) {
        this.logger = settings.logger || (0, get_default_logger_1.getDefaultLogger)();
        if (settings.connectionString) {
            var _a = (0, parse_connection_string_1.parseConnectionString)(settings.connectionString), endpoint = _a.endpoint, database = _a.database;
            this.endpoint = endpoint;
            this.database = database;
        }
        else if (!settings.endpoint) {
            throw new Error('The "endpoint" is a required field in driver settings');
        }
        else if (!settings.database) {
            throw new Error('The "database" is a required field in driver settings');
        }
        else {
            this.endpoint = settings.endpoint;
            this.database = settings.database;
        }
        this.sslCredentials = (0, ssl_credentials_1.makeSslCredentials)(this.endpoint, this.logger, settings.sslCredentials);
        this.authService = settings.authService;
        this.poolSettings = settings.poolSettings;
        this.clientOptions = settings.clientOptions;
        this.discoveryService = new discovery_service_1.default({
            endpoint: this.endpoint,
            database: this.database,
            authService: this.authService,
            sslCredentials: this.sslCredentials,
            discoveryPeriod: constants_1.ENDPOINT_DISCOVERY_PERIOD,
            logger: this.logger,
        });
        this.tableClient = new table_1.TableClient({
            database: this.database,
            authService: this.authService,
            sslCredentials: this.sslCredentials,
            poolSettings: this.poolSettings,
            clientOptions: this.clientOptions,
            discoveryService: this.discoveryService,
            logger: this.logger,
        });
        this.queryClient = new query_1.QueryClient({
            database: this.database,
            authService: this.authService,
            sslCredentials: this.sslCredentials,
            poolSettings: this.poolSettings,
            clientOptions: this.clientOptions,
            discoveryService: this.discoveryService,
            logger: this.logger,
        });
        this.schemeClient = new scheme_client_1.default({
            database: this.database,
            authService: this.authService,
            sslCredentials: this.sslCredentials,
            clientOptions: this.clientOptions,
            discoveryService: this.discoveryService,
            logger: this.logger,
        });
    }
    Driver.prototype.ready = function (timeout) {
        return __awaiter(this, void 0, void 0, function () {
            var e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.discoveryService.ready(timeout)];
                    case 1:
                        _a.sent();
                        this.logger.debug('Driver is ready!');
                        return [2 /*return*/, true];
                    case 2:
                        e_1 = _a.sent();
                        if (e_1 instanceof errors_1.TimeoutExpired) {
                            return [2 /*return*/, false];
                        }
                        else {
                            throw e_1;
                        }
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    Driver.prototype.destroy = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.logger.debug('Destroying driver...');
                        this.discoveryService.destroy();
                        return [4 /*yield*/, Promise.all([
                                this.tableClient.destroy(),
                                this.queryClient.destroy(),
                                this.schemeClient.destroy(),
                            ])];
                    case 1:
                        _a.sent();
                        this.logger.debug('Driver has been destroyed.');
                        return [2 /*return*/];
                }
            });
        });
    };
    Driver.prototype[Symbol.asyncDispose] = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.destroy()];
            });
        });
    };
    return Driver;
}());
exports.default = Driver;
