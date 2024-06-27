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
exports.ResultSet = void 0;
var symbols = require("./symbols");
var types_1 = require("../types");
var ResultSet = /** @class */ (function () {
    function ResultSet(index, columns, rowMode, rowsIterator // IValue when rowMode === RowType.Ydb otherwise an object where columns become properties
    ) {
        this.index = index;
        this.rowMode = rowMode;
        this.columns = columns;
        this.rows = rowsIterator[Symbol.asyncIterator]();
    }
    ResultSet.prototype.typedRows = function (type) {
        if (this.rowMode !== 1 /* RowType.Ydb */)
            throw new Error('Typed strings can only be retrieved in rowMode == RowType.Ydb');
        var columns = this.columns;
        // TODO: Check correspondence of required and received columns and their types
        function typedRows(self) {
            return __asyncGenerator(this, arguments, function typedRows_1() {
                var nativeColumns, rows, _a, ydbRow, done;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            nativeColumns = columns.map(function (col) { return types_1.snakeToCamelCaseConversion.ydbToJs(col.name); });
                            rows = self.rows;
                            _b.label = 1;
                        case 1:
                            if (!true) return [3 /*break*/, 7];
                            return [4 /*yield*/, __await(rows.next())];
                        case 2:
                            _a = _b.sent(), ydbRow = _a.value, done = _a.done;
                            if (!done) return [3 /*break*/, 4];
                            return [4 /*yield*/, __await(void 0)];
                        case 3: return [2 /*return*/, _b.sent()];
                        case 4: return [4 /*yield*/, __await(ydbRow.items.reduce(function (acc, value, index) {
                                acc[nativeColumns[index]] = (0, types_1.convertYdbValueToNative)(columns[index].type, value);
                                return acc;
                            }, Object.create(type.prototype)))];
                        case 5: return [4 /*yield*/, _b.sent()];
                        case 6:
                            _b.sent();
                            return [3 /*break*/, 1];
                        case 7: return [2 /*return*/];
                    }
                });
            });
        }
        return typedRows(this);
    };
    return ResultSet;
}());
exports.ResultSet = ResultSet;
symbols.resultsetYdbColumnsSymbol;
