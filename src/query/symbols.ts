/**
 * Symbols of methods internal to the package
 */

export const create = Symbol('create');

export const sessionAcquire = Symbol('sessionAcquire');
export const sessionRelease = Symbol('sessionRelease');
export const sessionIsFree = Symbol('sessionIsFree');
export const sessionIsClosing = Symbol('sessionIsClosing');
export const sessionDeleteOnRelease = Symbol('sessionDeleteOnRelease');
export const sessionIsDeleted = Symbol('sessionIsDeleted');
// export const sessionDelete = Symbol('sessionDelete'); // Note: Symbol named method do not support decorators
export const sessionAttach = Symbol('sessionAttach');
export const sessionBeginTransaction = Symbol('sessionBeginTransaction');
export const sessionCommitTransaction = Symbol('sessionCommitTransaction');
export const sessionRollbackTransaction = Symbol('sessionRollbackTransaction');

export const sessionId = Symbol('sessionId');
export const sessionTxId = Symbol('sessionTxId');
export const sessionTxSettings = Symbol('sessionTxSettings');
export const sessionCurrentOperation = Symbol('sessionCurrentOperation');
export const resultsetYdbColumns = Symbol('resultsetYdbColumns');
