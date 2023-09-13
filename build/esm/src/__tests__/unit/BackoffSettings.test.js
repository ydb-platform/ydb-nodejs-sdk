"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const retries_1 = require("../../retries");
const utils = __importStar(require("../../utils"));
function runTest(backoff, retries, min, max) {
    it(`have correct value for ${retries} retries`, () => {
        let timeout = -1;
        const spy = jest.spyOn(utils, 'sleep').mockImplementation((val) => {
            timeout = val;
            return Promise.resolve();
        });
        backoff.waitBackoffTimeout(retries);
        expect(spy).toBeCalled();
        expect(timeout).toBeGreaterThanOrEqual(min);
        expect(timeout).toBeLessThanOrEqual(max);
    });
}
describe('Fast backoff', () => {
    const fast = new retries_1.BackoffSettings(10, 5);
    afterEach(() => {
        // restore the spy created with spyOn
        jest.restoreAllMocks();
    });
    runTest(fast, 0, 2.5, 5);
    runTest(fast, 1, 5, 10);
    runTest(fast, 6, (1 << 6) * 5 * 0.5, (1 << 6) * 5);
    runTest(fast, 10, (1 << 10) * 5 * 0.5, (1 << 10) * 5);
    runTest(fast, 11, (1 << 10) * 5 * 0.5, (1 << 10) * 5);
});
describe('Slow backoff', () => {
    const slow = new retries_1.BackoffSettings(6, 1000);
    afterEach(() => {
        jest.restoreAllMocks();
    });
    runTest(slow, 0, 500, 1000);
    runTest(slow, 1, 1000, 2000);
    runTest(slow, 2, 2000, 4000);
    runTest(slow, 6, (1 << 6) * 1000 * 0.5, (1 << 6) * 1000);
    runTest(slow, 10, (1 << 6) * 1000 * 0.5, (1 << 6) * 1000);
});
