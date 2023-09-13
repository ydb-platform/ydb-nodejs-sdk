"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discovery_1 = __importDefault(require("./discovery"));
const table_1 = require("./table");
const constants_1 = require("./constants");
const errors_1 = require("./errors");
const logging_1 = require("./logging");
const scheme_1 = __importDefault(require("./scheme"));
const parse_connection_string_1 = require("./parse-connection-string");
const ssl_credentials_1 = require("./ssl-credentials");
class Driver {
    constructor(settings) {
        this.logger = settings.logger || (0, logging_1.getLogger)();
        if (settings.connectionString) {
            const { endpoint, database } = (0, parse_connection_string_1.parseConnectionString)(settings.connectionString);
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
        this.discoveryService = new discovery_1.default({
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
        this.schemeClient = new scheme_1.default({
            database: this.database,
            authService: this.authService,
            sslCredentials: this.sslCredentials,
            clientOptions: this.clientOptions,
            discoveryService: this.discoveryService,
            logger: this.logger,
        });
    }
    async ready(timeout) {
        try {
            await this.discoveryService.ready(timeout);
            this.logger.debug('Driver is ready!');
            return true;
        }
        catch (e) {
            if (e instanceof errors_1.TimeoutExpired) {
                return false;
            }
            else {
                throw e;
            }
        }
    }
    async destroy() {
        this.logger.debug('Destroying driver...');
        this.discoveryService.destroy();
        await this.tableClient.destroy();
        await this.schemeClient.destroy();
        this.logger.debug('Driver has been destroyed.');
    }
}
exports.default = Driver;
