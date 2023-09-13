"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const discovery_1 = require("../discovery");
const errors_1 = require("../errors");
const logging_1 = require("../logging");
const retries_1 = require("../retries");
const test_utils_1 = require("../test-utils");
const utils_1 = require("../utils");
const logger = new logging_1.FallbackLogger({ level: 'error' });
class ErrorThrower {
    endpoint;
    constructor(endpoint) {
        this.endpoint = endpoint;
    }
    errorThrower(callback) {
        return callback();
    }
}
__decorate([
    (0, retries_1.retryable)(new retries_1.RetryParameters({ maxRetries: 3, backoffCeiling: 3, backoffSlotDuration: 5 }), logger),
    utils_1.pessimizable
], ErrorThrower.prototype, "errorThrower", null);
describe('Retries on errors', () => {
    let driver;
    beforeAll(async () => {
        driver = await (0, test_utils_1.initDriver)({ logger });
    });
    afterAll(async () => await (0, test_utils_1.destroyDriver)(driver));
    /** Run session with error. retries_need can be  omitted if retries must not occur */
    function createError(error, retries_need = 1) {
        it(`${error.name}`, async () => {
            // here must be retries
            let retries = 0;
            const et = new ErrorThrower(new discovery_1.Endpoint({}, ''));
            await expect(driver.tableClient.withSession(async () => {
                await et.errorThrower(() => {
                    retries++;
                    throw new error('');
                });
            })).rejects.toThrow(error);
            expect(retries).toBe(retries_need);
        });
    }
    createError(errors_1.BadRequest);
    createError(errors_1.InternalError);
    createError(errors_1.Aborted, 3); // have retries
    createError(errors_1.Unauthenticated);
    createError(errors_1.Unauthorized);
    createError(errors_1.Unavailable, 3); // have retries
    createError(errors_1.Undetermined); // TODO: have retries for idempotent queries
    createError(errors_1.Overloaded, 3); // have retries
    createError(errors_1.SchemeError);
    createError(errors_1.GenericError);
    createError(errors_1.Timeout); // TODO: have retries for idempotent queries
    createError(errors_1.BadSession); // WHY?
    createError(errors_1.PreconditionFailed);
    // Transport/Client errors
    createError(errors_1.TransportUnavailable, 3); // TODO: have retries for idempotent queries, BUT now always have retries
    createError(errors_1.ClientResourceExhausted, 3);
    createError(errors_1.ClientDeadlineExceeded, 3);
});
