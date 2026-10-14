import { once } from 'node:events'

import type {
	ClientReadableStream,
	ClientUnaryCall,
	ClientWritableStream,
	requestCallback,
} from '@grpc/grpc-js'

export function unaryCall<Response>(
	start: (callback: requestCallback<Response>) => ClientUnaryCall,
	signal?: AbortSignal
): Promise<Response> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(signal.reason)
			return
		}

		let call: ClientUnaryCall | undefined
		let onAbort = () => {
			reject(signal?.reason)
			call?.cancel()
		}
		signal?.addEventListener('abort', onAbort, { once: true })

		try {
			call = start((error, response) => {
				signal?.removeEventListener('abort', onAbort)
				if (error) {
					reject(error)
				} else {
					resolve(response!)
				}
			})
			if (signal?.aborted) {
				call.cancel()
			}
		} catch (error) {
			signal?.removeEventListener('abort', onAbort)
			reject(error)
		}
	})
}

export async function* readStream<Response>(
	call: ClientReadableStream<Response>,
	signal?: AbortSignal
): AsyncGenerator<Response, void, undefined> {
	let onAbort = () => call.cancel()
	// Cancellation can emit an error after the iterator has returned.
	call.on('error', () => {})
	signal?.addEventListener('abort', onAbort, { once: true })

	try {
		signal?.throwIfAborted()
		yield* call
	} catch (error) {
		signal?.throwIfAborted()
		throw error
	} finally {
		signal?.removeEventListener('abort', onAbort)
		call.cancel()
	}
}

// The owner must release a pending input.next() on cancellation; this only stops writes and drain waits.
export async function writeStream<Request>(
	input: AsyncIterable<Request>,
	call: ClientWritableStream<Request>,
	signal?: AbortSignal
): Promise<void> {
	try {
		signal?.throwIfAborted()
		for await (let request of input) {
			signal?.throwIfAborted()
			if (!call.write(request)) {
				await once(call, 'drain', signal ? { signal } : undefined)
			}
		}
		signal?.throwIfAborted()
		call.end()
	} catch (error) {
		signal?.throwIfAborted()
		throw error
	}
}
