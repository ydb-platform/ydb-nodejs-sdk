"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseConnectionString = void 0;
const url_1 = __importDefault(require("url"));
function parseConnectionString(connectionString) {
    let cs = connectionString;
    if (!cs.startsWith('grpc://') && !cs.startsWith('grpcs://')) {
        cs = 'grpcs://' + cs;
    }
    let parsedUrl = url_1.default.parse(cs, true);
    let databaseParam = parsedUrl.query['database'];
    let database;
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
    const host = parsedUrl.host || 'localhost';
    return {
        endpoint: `${parsedUrl.protocol}//${host}`,
        database,
    };
}
exports.parseConnectionString = parseConnectionString;
