"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVersionHeader = void 0;
const package_json_1 = __importDefault(require("./../package.json"));
function getVersion() {
    return package_json_1.default.version;
}
function getLibraryName() {
    return `ydb-nodejs-sdk/${getVersion()}`;
}
function getVersionHeader() {
    return ['x-ydb-sdk-build-info', getLibraryName()];
}
exports.getVersionHeader = getVersionHeader;
