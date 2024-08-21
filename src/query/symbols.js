"use strict";
/**
 * Symbols of methods internal to the package
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resultsetYdbColumnsSymbol = exports.sessionCurrentOperationSymbol = exports.sessionTxSettingsSymbol = exports.sessionTxIdSymbol = exports.sessionIdSymbol = exports.isIdempotentSymbol = exports.isIdempotentDoLevelSymbol = exports.sessionRollbackTransactionSymbol = exports.sessionCommitTransactionSymbol = exports.sessionBeginTransactionSymbol = exports.sessionAttachSymbol = exports.sessionIsDeletedSymbol = exports.sessionDeleteOnReleaseSymbol = exports.sessionIsClosingSymbol = exports.sessionIsFreeSymbol = exports.sessionReleaseSymbol = exports.sessionAcquireSymbol = exports.ctxSymbol = exports.createSymbol = void 0;
exports.createSymbol = Symbol('create');
exports.ctxSymbol = Symbol('ctx');
exports.sessionAcquireSymbol = Symbol('sessionAcquire');
exports.sessionReleaseSymbol = Symbol('sessionRelease');
exports.sessionIsFreeSymbol = Symbol('sessionIsFree');
exports.sessionIsClosingSymbol = Symbol('sessionIsClosing');
exports.sessionDeleteOnReleaseSymbol = Symbol('sessionDeleteOnRelease');
exports.sessionIsDeletedSymbol = Symbol('sessionIsDeleted');
// export const sessionDelete = Symbol('sessionDelete'); // Note: Symbol named method do not support decorators
exports.sessionAttachSymbol = Symbol('sessionAttach');
exports.sessionBeginTransactionSymbol = Symbol('sessionBeginTransaction');
exports.sessionCommitTransactionSymbol = Symbol('sessionCommitTransaction');
exports.sessionRollbackTransactionSymbol = Symbol('sessionRollbackTransaction');
exports.isIdempotentDoLevelSymbol = Symbol('isIdempotentDoLevel');
exports.isIdempotentSymbol = Symbol('isIdempotent');
exports.sessionIdSymbol = Symbol('sessionId');
exports.sessionTxIdSymbol = Symbol('sessionTxId');
exports.sessionTxSettingsSymbol = Symbol('sessionTxSettings');
exports.sessionCurrentOperationSymbol = Symbol('sessionCurrentOperation');
exports.resultsetYdbColumnsSymbol = Symbol('resultsetYdbColumns');
