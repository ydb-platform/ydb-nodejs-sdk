/**
 * Symbols of methods internal to the package
 */

export const createSymbol = Symbol('create');

export const sessionAcquireSymbol = Symbol('sessionAcquire');
export const sessionReleaseSymbol = Symbol('sessionRelease');
export const sessionIsFreeSymbol = Symbol('sessionIsFree');
export const sessionIsClosingSymbol = Symbol('sessionIsClosing');
export const sessionDeleteOnReleaseSymbol = Symbol('sessionDeleteOnRelease');
export const sessionIsDeletedSymbol = Symbol('sessionIsDeleted');
// export const sessionDelete = Symbol('sessionDelete'); // Note: Symbol named method do not support decorators
export const sessionAttachSymbol = Symbol('sessionAttach');
export const sessionBeginTransactionSymbol = Symbol('sessionBeginTransaction');
export const sessionCommitTransactionSymbol = Symbol('sessionCommitTransaction');
export const sessionRollbackTransactionSymbol = Symbol('sessionRollbackTransaction');

export const sessionIdSymbol = Symbol('sessionId');
export const sessionTxIdSymbol = Symbol('sessionTxId');
export const sessionTxSettingsSymbol = Symbol('sessionTxSettings');
export const sessionIsIdempotentSymbol = Symbol('sessionIsIdempotent');
export const sessionCurrentOperationSymbol = Symbol('sessionCurrentOperation');
export const resultsetYdbColumnsSymbol = Symbol('resultsetYdbColumns');
