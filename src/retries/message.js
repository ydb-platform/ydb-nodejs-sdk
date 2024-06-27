"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tooManyAttempts = exports.successAfterNAttempts = exports.notRetryableErrorMessage = exports.slowBackoffRetryMessage = exports.fastBackoffRetryMessage = exports.immediateBackoffRetryMessage = void 0;
exports.immediateBackoffRetryMessage = 'Caught an error %s, retrying immediatly';
exports.fastBackoffRetryMessage = 'Caught an error %s, retrying with fast backoff in %d ms';
exports.slowBackoffRetryMessage = 'Caught an error %s, retrying with slow backoff in %d ms';
exports.notRetryableErrorMessage = 'Caught an error %s, it is not retriable';
exports.successAfterNAttempts = 'The operation completed successfully after %d attempts';
exports.tooManyAttempts = 'Too many attempts (obsolete approach): %d';
