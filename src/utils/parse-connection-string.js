"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseConnectionString = void 0;
var url_1 = require("url");
function parseConnectionString(connectionString) {
    var cs = connectionString;
    if (!cs.startsWith('grpc://') && !cs.startsWith('grpcs://')) {
        cs = 'grpcs://' + cs;
    }
    var parsedUrl = url_1.default.parse(cs, true);
    var databaseParam = parsedUrl.query['database'];
    var database;
    if (databaseParam === undefined) {
        throw new Error('unknown database');
    }
    else if (Array.isArray(databaseParam)) {
        if (databaseParam.length === 0) {
            throw new Error('unknown database');
        }
        database = databaseParam[0];
    }
    else {
        database = databaseParam;
    }
    var host = parsedUrl.host || 'localhost';
    return {
        endpoint: "".concat(parsedUrl.protocol, "//").concat(host),
        database: database,
    };
}
exports.parseConnectionString = parseConnectionString;
