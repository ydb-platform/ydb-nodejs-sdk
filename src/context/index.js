"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextSymbols = exports.ensureContext = exports.setContextIdGenerator = exports.Context = void 0;
var context_1 = require("./context");
Object.defineProperty(exports, "Context", { enumerable: true, get: function () { return context_1.Context; } });
Object.defineProperty(exports, "setContextIdGenerator", { enumerable: true, get: function () { return context_1.setContextIdGenerator; } });
var ensure_context_1 = require("./ensure-context");
Object.defineProperty(exports, "ensureContext", { enumerable: true, get: function () { return ensure_context_1.ensureContext; } });
exports.contextSymbols = require("./symbols");
