import { once } from 'node:events'
import {
	type ClientReadableStream,
	type ClientUnaryCall,
	type ClientWritableStream,
	Client as GrpcClient,
} from '@grpc/grpc-js'

import { wrapClientError } from './error.js'
import { fromGrpcMetadata, toGrpcMetadata } from './metadata.js'
import type { AnyMethodDefinition, CallOptions } from './types.js'

export async function* invoke(
	client: GrpcClient,
	method: AnyMethodDefinition,
	request: any,
	options: CallOptions
): AsyncGenerator<any, any, undefined> {
	let streamingRequest = request != null && typeof request[Symbol.asyncIterator] === 'function'
	if (streamingRequest !== method.requestStream) {
		throw new TypeError(
			method.requestStream
				? 'Expected an async iterable request'
				: 'Expected a single request'
		)
	}

	let abortReason = () =>
		method.responseStream
			? Object.assign(new Error('The operation has been aborted'), { name: 'AbortError' })
			: options.signal!.reason

	if (options.signal?.aborted) {
		throw abortReason()
	}

	let serialize = (value: any) => {
		let bytes = method.requestSerialize(value)
		return method.requestBufferOwned
			? Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
			: Buffer.from(bytes)
	}
	let metadata = toGrpcMetadata(options.metadata)
	let resolve!: (value: any) => void
	let reject!: (reason: unknown) => void
	let result = new Promise<any>((resolveResponse, rejectResponse) => {
		resolve = resolveResponse
		reject = rejectResponse
	})
	let callback = (error: Error | null, response?: any) => {
		if (error) {
			reject(wrapClientError(error, method.path))
		} else {
			resolve(response)
		}
	}

	let call: ClientUnaryCall | ClientReadableStream<any> | ClientWritableStream<any>
	if (method.requestStream) {
		call = method.responseStream
			? client.makeBidiStreamRequest(
					method.path,
					serialize,
					method.responseDeserialize,
					metadata
				)
			: client.makeClientStreamRequest(
					method.path,
					serialize,
					method.responseDeserialize,
					metadata,
					callback
				)
	} else {
		call = method.responseStream
			? client.makeServerStreamRequest(
					method.path,
					serialize,
					method.responseDeserialize,
					request,
					metadata
				)
			: client.makeUnaryRequest(
					method.path,
					serialize,
					method.responseDeserialize,
					request,
					metadata,
					callback
				)
	}

	call.on('metadata', (header) => options.onHeader?.(fromGrpcMetadata(header)))
	call.on('status', (status) => options.onTrailer?.(fromGrpcMetadata(status.metadata)))
	// A write can fail before the response iterator starts, or after its consumer leaves.
	if (method.requestStream || method.responseStream) {
		let stream = call as ClientReadableStream<any>
		stream.on('error', () => {})
	}

	let stopped = new AbortController()
	let pipeError: unknown
	if (method.requestStream) {
		let writable = call as ClientWritableStream<any>
		void writeRequests(writable, request, stopped.signal).catch((error) => {
			if (!stopped.signal.aborted) {
				pipeError = error
				if (!method.responseStream) {
					reject(error)
				}
				call.cancel()
			}
		})
	}

	let onAbort = () => {
		stopped.abort()
		if (!method.responseStream) {
			reject(abortReason())
		}
		call.cancel()
	}
	options.signal?.addEventListener('abort', onAbort, { once: true })

	try {
		if (method.responseStream) {
			yield* call as ClientReadableStream<any>
			return
		}
		return await result
	} catch (error) {
		throw pipeError ?? wrapClientError(error, method.path)
	} finally {
		stopped.abort()
		options.signal?.removeEventListener('abort', onAbort)
		call.cancel()

		if (options.signal?.aborted) {
			// eslint-disable-next-line no-unsafe-finally -- Cancellation takes precedence over transport status.
			throw abortReason()
		}
		if (pipeError !== undefined) {
			// eslint-disable-next-line no-unsafe-finally -- Preserve the producer error instead of the resulting CANCELLED.
			throw pipeError
		}
	}
}

async function writeRequests(
	call: ClientWritableStream<any>,
	request: AsyncIterable<any>,
	signal: AbortSignal
) {
	for await (let message of request) {
		signal.throwIfAborted()
		if (!call.write(message)) {
			await once(call, 'drain', { signal })
		}
	}
	if (!signal.aborted) {
		call.end()
	}
}
