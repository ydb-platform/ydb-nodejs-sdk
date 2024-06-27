"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVersionHeader = void 0;
var package_json_1 = require("./../package.json");
function getVersion() {
    return package_json_1.default.version;
}
function getLibraryName() {
    return "ydb-nodejs-sdk/".concat(getVersion());
}
function getVersionHeader() {
    return ['x-ydb-sdk-build-info', getLibraryName()];
}
exports.getVersionHeader = getVersionHeader;
