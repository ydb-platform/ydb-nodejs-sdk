import { setTimeout } from 'node:timers/promises'

import {
	Client,
	type ClientWritableStream,
	Metadata,
	Server,
	ServerCredentials,
	type ServiceError,
	type StatusObject,
	credentials,
	type handleBidiStreamingCall,
	type handleClientStreamingCall,
	type handleServerStreamingCall,
	type handleUnaryCall,
	status,
} from '@grpc/grpc-js'
import { expect, test } from 'vitest'

import { readStream, unaryCall, writeStream } from './stream.js'

interface Message {
	value: number
	padding?: Uint8Array
}

function serialize(message: Message): Buffer {
	let bytes = Buffer.allocUnsafe(4 + (message.padding?.length ?? 0))
	bytes.writeUInt32LE(message.value)
	if (message.padding) {
		bytes.set(message.padding, 4)
	}

	return bytes
}

function deserialize(bytes: Buffer): Message {
	return { value: bytes.readUInt32LE(), padding: bytes.subarray(4) }
}

function method(name: string, requestStream: boolean, responseStream: boolean) {
	return {
		path: `/test.Stream/${name}`,
		requestStream,
		responseStream,
		requestSerialize: serialize,
		requestDeserialize: deserialize,
		responseSerialize: serialize,
		responseDeserialize: deserialize,
	}
}

let definition = {
	unary: method('Unary', false, false),
	server: method('Server', false, true),
	client: method('Client', true, false),
	bidi: method('Bidi', true, true),
}

interface Handlers {
	unary?: handleUnaryCall<Message, Message>
	server?: handleServerStreamingCall<Message, Message>
	client?: handleClientStreamingCall<Message, Message>
	bidi?: handleBidiStreamingCall<Message, Message>
}

// A loopback peer makes transport EOF, cancellation and non-OK trailers deterministic.
async function serve(handlers: Handlers) {
	let server = new Server()
	server.addService(definition, { ...handlers })
	let port = await new Promise<number>((resolve, reject) => {
		server.bindAsync('127.0.0.1:0', ServerCredentials.createInsecure(), (error, boundPort) => {
			if (error) {
				reject(error)
			} else {
				resolve(boundPort)
			}
		})
	})
	let client = new Client(`127.0.0.1:${port}`, credentials.createInsecure())

	return {
		client,
		[Symbol.dispose]() {
			client.close()
			server.forceShutdown()
		},
	}
}

async function* messages(...values: number[]) {
	for (let value of values) {
		yield { value }
	}
}

async function collect(stream: AsyncIterable<Message>): Promise<number[]> {
	let values: number[] = []
	for await (let message of stream) {
		values.push(message.value)
	}

	return values
}

test('returns a unary response and leaves metadata on the native call', async (tc) => {
	let received: Metadata | undefined
	using peer = await serve({
		unary(call, respond) {
			received = call.metadata
			let headers = new Metadata()
			headers.set('x-header', 'header')
			call.sendMetadata(headers)
			let trailers = new Metadata()
			trailers.set('x-trailer', 'trailer')
			respond(null, { value: call.request.value + 1 }, trailers)
		},
	})
	let metadata = new Metadata()
	metadata.set('x-request', 'request')
	metadata.set('x-data-bin', Buffer.from([1, 2, 3]))
	let headers: Metadata | undefined
	let completion = Promise.withResolvers<StatusObject>()

	let response = await unaryCall<Message>((callback) => {
		let call = peer.client.makeUnaryRequest(
			definition.unary.path,
			serialize,
			deserialize,
			{ value: 41 },
			metadata,
			callback
		)
		call.on('metadata', (value: Metadata) => {
			headers = value
		})
		call.on('status', completion.resolve)
		return call
	}, tc.signal)

	expect(response.value).toBe(42)
	expect(received?.get('x-request')).toEqual(['request'])
	expect(received?.get('x-data-bin')).toEqual([Buffer.from([1, 2, 3])])
	expect(headers?.get('x-header')).toEqual(['header'])
	expect((await completion.promise).metadata.get('x-trailer')).toEqual(['trailer'])
})

test('preserves the native unary error and trailers', async (tc) => {
	using peer = await serve({
		unary(_call, respond) {
			let metadata = new Metadata()
			metadata.set('retry-info', 'later')
			respond({ code: status.RESOURCE_EXHAUSTED, details: 'capacity', metadata })
		},
	})
	let nativeError: ServiceError | null | undefined
	let response = unaryCall<Message>((callback) => {
		return peer.client.makeUnaryRequest(
			definition.unary.path,
			serialize,
			deserialize,
			{ value: 1 },
			(error, value) => {
				nativeError = error
				callback(error, value)
			}
		)
	}, tc.signal)

	await expect(response).rejects.toMatchObject({
		code: status.RESOURCE_EXHAUSTED,
		details: 'capacity',
	})
	await expect(response).rejects.toBe(nativeError)
	expect(nativeError?.metadata.get('retry-info')).toEqual(['later'])
})

test('does not start an already-aborted unary call', async (tc) => {
	using peer = await serve({})
	let controller = new AbortController()
	let reason = new Error('cancelled by caller')
	controller.abort(reason)
	let started = false

	let response = unaryCall<Message>(
		(callback) => {
			started = true
			return peer.client.makeUnaryRequest(
				definition.unary.path,
				serialize,
				deserialize,
				{ value: 1 },
				callback
			)
		},
		AbortSignal.any([tc.signal, controller.signal])
	)

	await expect(response).rejects.toBe(reason)
	expect(started).toBe(false)
})

test('cancels an active unary call with the caller reason', async (tc) => {
	let started = Promise.withResolvers<void>()
	let cancelled = Promise.withResolvers<void>()
	using peer = await serve({
		unary(call) {
			call.on('cancelled', cancelled.resolve)
			started.resolve()
		},
	})
	let controller = new AbortController()
	let reason = new Error('cancelled by caller')
	let response = unaryCall<Message>(
		(callback) => {
			return peer.client.makeUnaryRequest(
				definition.unary.path,
				serialize,
				deserialize,
				{ value: 1 },
				callback
			)
		},
		AbortSignal.any([tc.signal, controller.signal])
	)

	await started.promise
	controller.abort(reason)

	await expect(response).rejects.toBe(reason)
	await cancelled.promise
})

test('delivers bursty responses in order through successful EOF', async (tc) => {
	using peer = await serve({
		server(call) {
			call.write({ value: 1 })
			call.write({ value: 2 })
			setImmediate(() => {
				call.write({ value: 3 })
				let trailers = new Metadata()
				trailers.set('x-trailer', 'complete')
				call.end(trailers)
			})
		},
	})
	let call = peer.client.makeServerStreamRequest(definition.server.path, serialize, deserialize, {
		value: 0,
	})
	let completion = Promise.withResolvers<StatusObject>()
	call.on('status', completion.resolve)
	let values: number[] = []

	for await (let message of readStream(call, tc.signal)) {
		values.push(message.value)
		await setTimeout(1, undefined, { signal: tc.signal })
	}

	expect(values).toEqual([1, 2, 3])
	expect((await completion.promise).code).toBe(status.OK)
	expect((await completion.promise).metadata.get('x-trailer')).toEqual(['complete'])
})

test('preserves the native streaming error after earlier responses', async (tc) => {
	using peer = await serve({
		server(call) {
			call.write({ value: 1 })
			setImmediate(() => {
				let metadata = new Metadata()
				metadata.set('retry-info', 'later')
				call.emit('error', { code: status.UNAVAILABLE, details: 'offline', metadata })
			})
		},
	})
	let call = peer.client.makeServerStreamRequest(definition.server.path, serialize, deserialize, {
		value: 0,
	})
	let nativeError: ServiceError | undefined
	call.on('error', (error: ServiceError) => {
		nativeError = error
	})
	let values: number[] = []
	let result = (async () => {
		for await (let message of readStream(call, tc.signal)) {
			values.push(message.value)
		}
	})()

	await expect(result).rejects.toMatchObject({ code: status.UNAVAILABLE, details: 'offline' })
	await expect(result).rejects.toBe(nativeError)
	expect(nativeError?.metadata.get('retry-info')).toEqual(['later'])
	expect(values).toEqual([1])
})

test('cancels a server stream when its consumer breaks', async (tc) => {
	let cancelled = Promise.withResolvers<void>()
	using peer = await serve({
		server(call) {
			call.on('cancelled', cancelled.resolve)
			call.write({ value: 1 })
		},
	})
	let call = peer.client.makeServerStreamRequest(definition.server.path, serialize, deserialize, {
		value: 0,
	})

	for await (let message of readStream(call, tc.signal)) {
		expect(message.value).toBe(1)
		break
	}

	await cancelled.promise
})

test('rejects an already-aborted response stream with the caller reason', async (tc) => {
	using peer = await serve({})
	let controller = new AbortController()
	let reason = new Error('cancelled by caller')
	controller.abort(reason)
	let call = peer.client.makeServerStreamRequest(definition.server.path, serialize, deserialize, {
		value: 0,
	})

	await expect(
		collect(readStream(call, AbortSignal.any([tc.signal, controller.signal])))
	).rejects.toBe(reason)
})

test('cancels a pending response read with the caller reason', async (tc) => {
	let started = Promise.withResolvers<void>()
	let cancelled = Promise.withResolvers<void>()
	using peer = await serve({
		server(call) {
			call.on('cancelled', cancelled.resolve)
			started.resolve()
		},
	})
	let controller = new AbortController()
	let reason = new Error('cancelled by caller')
	let call = peer.client.makeServerStreamRequest(definition.server.path, serialize, deserialize, {
		value: 0,
	})
	let result = collect(readStream(call, AbortSignal.any([tc.signal, controller.signal])))

	await started.promise
	controller.abort(reason)

	await expect(result).rejects.toBe(reason)
	await cancelled.promise
})

test('keeps bidi responses readable after request half-close', async (tc) => {
	using peer = await serve({
		bidi(call) {
			let received: number[] = []
			call.on('data', (message: Message) => {
				received.push(message.value)
			})
			call.on('end', () => {
				setImmediate(() => {
					for (let value of received) {
						call.write({ value })
					}
					call.end()
				})
			})
		},
	})
	let call = peer.client.makeBidiStreamRequest(definition.bidi.path, serialize, deserialize)
	let response = collect(readStream(call, tc.signal))

	await writeStream(messages(1, 2, 3), call, tc.signal)

	expect(await response).toEqual([1, 2, 3])
})

test('bounds request production while the peer stops reading', async (tc) => {
	let connected = Promise.withResolvers<() => void>()
	let produced = 0
	let padding = new Uint8Array(128 * 1024)
	using peer = await serve({
		client(call, respond) {
			let received = 0
			call.on('data', () => {
				received++
			})
			call.on('end', () => {
				respond(null, { value: received })
			})
			call.pause()
			connected.resolve(() => call.resume())
		},
	})
	async function* request() {
		for (let value = 0; value < 256; value++) {
			produced++
			yield { value, padding }
		}
	}
	let call: ClientWritableStream<Message> | undefined
	let response = unaryCall<Message>((callback) => {
		call = peer.client.makeClientStreamRequest(
			definition.client.path,
			serialize,
			deserialize,
			callback
		)
		return call
	}, tc.signal)
	let writing = writeStream(request(), call!, tc.signal)
	let resume = await connected.promise

	try {
		await setTimeout(50, undefined, { signal: tc.signal })
		expect(produced).toBeGreaterThan(0)
		expect(produced).toBeLessThan(256)
	} finally {
		resume()
	}

	await writing
	expect((await response).value).toBe(256)
})

test('preserves the producer error for the caller that owns cancellation', async (tc) => {
	let started = Promise.withResolvers<void>()
	let cancelled = Promise.withResolvers<void>()
	let failure = new Error('producer failed')
	using peer = await serve({
		bidi(call) {
			call.on('cancelled', cancelled.resolve)
			call.on('data', started.resolve)
		},
	})
	async function* request() {
		yield { value: 1 }
		await started.promise
		throw failure
	}
	let call = peer.client.makeBidiStreamRequest(definition.bidi.path, serialize, deserialize)
	let response = collect(readStream(call, tc.signal))
	let cancelledResponse = response.catch((error: unknown) => error)

	await expect(writeStream(request(), call, tc.signal)).rejects.toBe(failure)
	call.cancel()

	expect(await cancelledResponse).toMatchObject({ code: status.CANCELLED })
	await cancelled.promise
})

test('does not consume an already-aborted request producer', async (tc) => {
	using peer = await serve({})
	let controller = new AbortController()
	let reason = new Error('cancelled by caller')
	controller.abort(reason)
	let consumed = false
	async function* request() {
		consumed = true
		yield { value: 1 }
	}
	let call = peer.client.makeBidiStreamRequest(definition.bidi.path, serialize, deserialize)
	call.on('error', () => {})

	await expect(
		writeStream(request(), call, AbortSignal.any([tc.signal, controller.signal]))
	).rejects.toBe(reason)
	expect(consumed).toBe(false)
	call.cancel()
})

test('stops writing when the owner releases an aborted request producer', async (tc) => {
	let started = Promise.withResolvers<void>()
	let release = Promise.withResolvers<void>()
	let cancelled = Promise.withResolvers<void>()
	let received: number[] = []
	using peer = await serve({
		bidi(call) {
			call.on('cancelled', cancelled.resolve)
			call.on('data', (message: Message) => {
				received.push(message.value)
				started.resolve()
			})
		},
	})
	async function* request() {
		yield { value: 1 }
		await release.promise
		yield { value: 2 }
	}
	let controller = new AbortController()
	let reason = new Error('cancelled by caller')
	let call = peer.client.makeBidiStreamRequest(definition.bidi.path, serialize, deserialize)
	call.on('error', () => {})
	let writing = writeStream(request(), call, AbortSignal.any([tc.signal, controller.signal]))

	try {
		await started.promise
		controller.abort(reason)
		release.resolve()
		await expect(writing).rejects.toBe(reason)
		expect(call.writableEnded).toBe(false)
		call.cancel()
		await cancelled.promise
		expect(received).toEqual([1])
	} finally {
		call.cancel()
		release.resolve()
	}
})

test('preserves the native write error while waiting for drain', async (tc) => {
	using peer = await serve({
		bidi(call) {
			call.once('data', () => {
				call.pause()
				call.emit('error', { code: status.RESOURCE_EXHAUSTED, details: 'capacity' })
			})
		},
	})
	let padding = new Uint8Array(128 * 1024)
	async function* request() {
		for (let value = 0; value < 256; value++) {
			yield { value, padding }
		}
	}
	let call = peer.client.makeBidiStreamRequest(definition.bidi.path, serialize, deserialize)
	let nativeError: ServiceError | undefined
	call.on('error', (error: ServiceError) => {
		nativeError = error
	})
	let writing = writeStream(request(), call, tc.signal)

	await expect(writing).rejects.toMatchObject({
		code: status.RESOURCE_EXHAUSTED,
		details: 'capacity',
	})
	await expect(writing).rejects.toBe(nativeError)
})

test('aborts a pending drain with the caller reason', async (tc) => {
	let connected = Promise.withResolvers<void>()
	let cancelled = Promise.withResolvers<void>()
	using peer = await serve({
		bidi(call) {
			call.on('cancelled', cancelled.resolve)
			call.pause()
			connected.resolve()
		},
	})
	let produced = 0
	let padding = new Uint8Array(128 * 1024)
	async function* request() {
		for (let value = 0; value < 256; value++) {
			produced++
			yield { value, padding }
		}
	}
	let controller = new AbortController()
	let reason = new Error('cancelled by caller')
	let call = peer.client.makeBidiStreamRequest(definition.bidi.path, serialize, deserialize)
	call.on('error', () => {})
	let writing = writeStream(request(), call, AbortSignal.any([tc.signal, controller.signal]))

	try {
		await connected.promise
		await setTimeout(50, undefined, { signal: tc.signal })
		expect(produced).toBeGreaterThan(0)
		expect(produced).toBeLessThan(256)
		controller.abort(reason)
		await expect(writing).rejects.toBe(reason)
	} finally {
		call.cancel()
	}

	await cancelled.promise
})
