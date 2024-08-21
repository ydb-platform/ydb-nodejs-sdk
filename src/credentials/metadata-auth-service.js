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
exports.MetadataAuthService = void 0;
var add_credentials_to_metadata_1 = require("./add-credentials-to-metadata");
var utils_1 = require("../utils");
var MetadataAuthService = /** @class */ (function () {
    /** Do not use this, use MetadataAuthService.create */
    function MetadataAuthService(tokenService) {
        this.tokenService = tokenService;
    }
    /**
     * Load @yandex-cloud/nodejs-sdk and create `MetadataTokenService` if tokenService is not set
     */
    MetadataAuthService.prototype.createMetadata = function () {
        return __awaiter(this, void 0, void 0, function () {
            var MetadataTokenService_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.tokenService) return [3 /*break*/, 2];
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('@yandex-cloud/nodejs-sdk/dist/token-service/metadata-token-service'); })];
                    case 1:
                        MetadataTokenService_1 = (_a.sent()).MetadataTokenService;
                        this.MetadataTokenServiceClass = MetadataTokenService_1;
                        this.tokenService = new MetadataTokenService_1();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    MetadataAuthService.prototype.getAuthMetadata = function () {
        return __awaiter(this, void 0, void 0, function () {
            var token;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.createMetadata()];
                    case 1:
                        _a.sent();
                        if (!(this.MetadataTokenServiceClass &&
                            this.tokenService instanceof this.MetadataTokenServiceClass)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.tokenService.getToken()];
                    case 2:
                        token = _a.sent();
                        return [2 /*return*/, (0, add_credentials_to_metadata_1.addCredentialsToMetadata)(token)];
                    case 3: return [2 /*return*/, this.getAuthMetadataCompat()];
                }
            });
        });
    };
    // Compatibility method for working with TokenService defined in yandex-cloud@1.x
    MetadataAuthService.prototype.getAuthMetadataCompat = function () {
        return __awaiter(this, void 0, void 0, function () {
            var MAX_TRIES, tokenService, token, tries;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        MAX_TRIES = 5;
                        tokenService = this.tokenService;
                        token = tokenService.getToken();
                        if (!(!token && typeof tokenService.initialize === 'function')) return [3 /*break*/, 2];
                        return [4 /*yield*/, tokenService.initialize()];
                    case 1:
                        _a.sent();
                        token = tokenService.getToken();
                        _a.label = 2;
                    case 2:
                        tries = 0;
                        _a.label = 3;
                    case 3:
                        if (!(!token && tries < MAX_TRIES)) return [3 /*break*/, 5];
                        return [4 /*yield*/, (0, utils_1.sleep)(2000)];
                    case 4:
                        _a.sent();
                        tries++;
                        token = tokenService.getToken();
                        return [3 /*break*/, 3];
                    case 5:
                        if (token) {
                            return [2 /*return*/, (0, add_credentials_to_metadata_1.addCredentialsToMetadata)(token)];
                        }
                        throw new Error("Failed to fetch access token via metadata service in ".concat(MAX_TRIES, " tries!"));
                }
            });
        });
    };
    return MetadataAuthService;
}());
exports.MetadataAuthService = MetadataAuthService;
