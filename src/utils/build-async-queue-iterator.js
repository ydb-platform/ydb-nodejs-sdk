"use strict";
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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAsyncQueueIterator = void 0;
var QUEUE_END = Symbol('QUEUE_END');
function buildAsyncQueueIterator() {
    var _a;
    var waitNextItemPromiseResolve;
    var waitNextItemPromiseReject;
    var queue = [];
    var isQueueOver;
    var error;
    var isGeneratorInstantiated;
    return _a = {
            push: function (value) {
                if (error)
                    return; // queue is already droped
                if (isQueueOver)
                    throw new Error('The queue has already been closed by calling end()');
                if (waitNextItemPromiseResolve) {
                    waitNextItemPromiseResolve(value);
                    waitNextItemPromiseResolve = waitNextItemPromiseReject = undefined;
                }
                else {
                    queue.push(value);
                }
            },
            end: function () {
                if (isQueueOver)
                    throw new Error('The queue has already been closed by calling end()');
                isQueueOver = true;
                if (waitNextItemPromiseResolve)
                    waitNextItemPromiseResolve(QUEUE_END);
                waitNextItemPromiseResolve = waitNextItemPromiseReject = undefined;
            },
            error: function (err) {
                error = err;
                queue.length = 0; // drop queue
                if (waitNextItemPromiseReject)
                    waitNextItemPromiseReject(err);
                waitNextItemPromiseResolve = waitNextItemPromiseReject = undefined;
            }
        },
        _a[Symbol.asyncIterator] = function () {
            return __asyncGenerator(this, arguments, function _a() {
                var waitNextItemPromise, value;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            if (isGeneratorInstantiated)
                                throw new Error('Сan be only ONE instance of the generator');
                            isGeneratorInstantiated = true;
                            _b.label = 1;
                        case 1:
                            if (!true) return [3 /*break*/, 13];
                            if (error)
                                throw error;
                            if (!(queue.length > 0)) return [3 /*break*/, 4];
                            return [4 /*yield*/, __await(queue.shift())];
                        case 2: return [4 /*yield*/, _b.sent()];
                        case 3:
                            _b.sent();
                            return [3 /*break*/, 12];
                        case 4:
                            if (!isQueueOver) return [3 /*break*/, 6];
                            return [4 /*yield*/, __await(void 0)];
                        case 5: return [2 /*return*/, _b.sent()];
                        case 6:
                            waitNextItemPromise = new Promise(function (resolve, reject) {
                                waitNextItemPromiseResolve = resolve;
                                waitNextItemPromiseReject = reject;
                            });
                            return [4 /*yield*/, __await(waitNextItemPromise)];
                        case 7:
                            value = _b.sent();
                            if (!(value === QUEUE_END)) return [3 /*break*/, 9];
                            return [4 /*yield*/, __await(void 0)];
                        case 8: return [2 /*return*/, _b.sent()];
                        case 9: return [4 /*yield*/, __await(value)];
                        case 10: return [4 /*yield*/, _b.sent()];
                        case 11:
                            _b.sent();
                            _b.label = 12;
                        case 12: return [3 /*break*/, 1];
                        case 13: return [2 /*return*/];
                    }
                });
            });
        },
        _a;
}
exports.buildAsyncQueueIterator = buildAsyncQueueIterator;
