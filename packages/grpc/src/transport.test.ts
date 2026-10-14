import { setTimeout } from 'node:timers/promises'

import {
	Channel,
	Metadata as GrpcMetadata,
	Server,
	ServerCredentials,
	credentials,
	type handleBidiStreamingCall,
	type handleClientStreamingCall,
	type handleServerStreamingCall,
	type handleUnaryCall,
} from '@grpc/grpc-js'
import { expect, test } from 'vitest'

import {
	ClientError,
	type ClientMiddleware,
	Metadata,
	Status,
	composeClientMiddleware,
	createChannel,
	createClient,
} from './index.js'

interface Message {
	value: number
	padding?: Uint8Array
}

function method<RequestStream extends boolean, ResponseStream extends boolean>(
	name: string,
	requestStream: RequestStream,
	responseStream: ResponseStream
) {
	function serialize(message: Message): Buffer {
		let bytes = Buffer.allocUnsafe(4 + (message.padding?.length ?? 0))
		bytes.writeUInt32LE(message.value)
		if (message.padding) {
			bytes.set(message.padding, 4)
		}

		return bytes
	}

	function deserialize(bytes: Uint8Array): Message {
		let view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
		return { value: view.readUInt32LE(), padding: bytes.subarray(4) }
	}

	return {
		path: `/test.Transport/${name}`,
		requestStream,
		responseStream,
		requestSerialize: serialize,
		requestDeserialize: deserialize,
		responseSerialize: serialize,
		responseDeserialize: deserialize,
		options: {},
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

// A loopback peer can deterministically control protocol EOF, cancellation and non-OK trailers.
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
	let channel = new Channel(`127.0.0.1:${port}`, credentials.createInsecure(), {})

	return {
		channel,
		client: createClient(definition, channel),
		[Symbol.dispose]() {
			channel.close()
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

test('returns a unary response', async (tc) => {
	using peer = await serve({
		unary(call, respond) {
			respond(null, { value: call.request.value + 1 })
		},
	})

	let response = await peer.client.unary({ value: 41 }, { signal: tc.signal })
	expect(response.value).toBe(42)
})

test('delivers bursty server responses in order', async (tc) => {
	using peer = await serve({
		server(call) {
			call.write({ value: 1 })
			call.write({ value: 2 })
			setImmediate(() => {
				call.write({ value: 3 })
				call.end()
			})
		},
	})

	let values: number[] = []
	for await (let message of peer.client.server({ value: 0 }, { signal: tc.signal })) {
		values.push(message.value)
		await setTimeout(1, undefined, { signal: tc.signal })
	}
	expect(values).toEqual([1, 2, 3])
})

test('half-closes client requests before receiving the unary response', async (tc) => {
	using peer = await serve({
		client(call, respond) {
			let sum = 0
			call.on('data', (message: Message) => {
				sum += message.value
			})
			call.on('end', () => {
				respond(null, { value: sum })
			})
		},
	})

	let response = await peer.client.client(messages(1, 2, 3), {
		signal: tc.signal,
	})
	expect(response.value).toBe(6)
})

test('preserves bidi responses sent after request half-close', async (tc) => {
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

	expect(await collect(peer.client.bidi(messages(1, 2, 3), { signal: tc.signal }))).toEqual([
		1, 2, 3,
	])
})

test('receives bidi responses while the request producer is waiting', async (tc) => {
	let nextRequest = Promise.withResolvers<void>()
	using peer = await serve({
		bidi(call) {
			call.on('data', (message: Message) => {
				call.write(message)
			})
			call.on('end', () => {
				call.end()
			})
		},
	})
	async function* request() {
		yield { value: 1 }
		await nextRequest.promise
		yield { value: 2 }
	}

	let responses = peer.client.bidi(request(), { signal: tc.signal })[Symbol.asyncIterator]()
	try {
		expect((await responses.next()).value?.value).toBe(1)
		nextRequest.resolve()
		expect((await responses.next()).value?.value).toBe(2)
		expect((await responses.next()).done).toBe(true)
	} finally {
		nextRequest.resolve()
		await responses.return?.()
	}
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

	let response = peer.client.client(request(), { signal: tc.signal })
	let resume = await Promise.race([
		connected.promise,
		response.then(() => {
			throw new Error('RPC completed before peer connected')
		}),
	])
	try {
		await setTimeout(50, undefined, { signal: tc.signal })
		expect(produced).toBeGreaterThan(0)
		expect(produced).toBeLessThan(256)
	} finally {
		resume()
	}

	expect((await response).value).toBe(256)
})

test('propagates a client request producer error and cancels its RPC', async (tc) => {
	let started = Promise.withResolvers<void>()
	let cancelled = Promise.withResolvers<void>()
	let failure = new Error('producer failed')
	using peer = await serve({
		client(call) {
			call.on('cancelled', cancelled.resolve)
			call.on('data', started.resolve)
		},
	})
	async function* request() {
		yield { value: 1 }
		await started.promise
		throw failure
	}

	await expect(peer.client.client(request(), { signal: tc.signal })).rejects.toBe(failure)
	await cancelled.promise
})

test('propagates a bidi request producer error after an earlier response', async (tc) => {
	let fail = Promise.withResolvers<void>()
	let failure = new Error('producer failed')
	using peer = await serve({
		bidi(call) {
			call.on('data', (message: Message) => {
				call.write(message)
			})
		},
	})
	async function* request() {
		yield { value: 1 }
		await fail.promise
		throw failure
	}

	let responses = peer.client.bidi(request(), { signal: tc.signal })[Symbol.asyncIterator]()
	try {
		expect((await responses.next()).value?.value).toBe(1)
		fail.resolve()
		await expect(responses.next()).rejects.toBe(failure)
	} finally {
		fail.resolve()
		await responses.return?.()
	}
})

test('cancels a server stream when its consumer breaks', async (tc) => {
	let cancelled = Promise.withResolvers<void>()
	using peer = await serve({
		server(call) {
			call.on('cancelled', cancelled.resolve)
			call.write({ value: 1 })
		},
	})

	for await (let message of peer.client.server({ value: 0 }, { signal: tc.signal })) {
		expect(message.value).toBe(1)
		break
	}
	await cancelled.promise
})

test('cancels bidi on consumer break even with a blocked request iterator', async (tc) => {
	let cancelled = Promise.withResolvers<void>()
	let release = Promise.withResolvers<void>()
	using peer = await serve({
		bidi(call) {
			call.on('cancelled', cancelled.resolve)
			call.on('data', () => {
				call.write({ value: 1 })
			})
		},
	})
	async function* request() {
		yield { value: 1 }
		await release.promise
	}

	try {
		for await (let message of peer.client.bidi(request(), {
			signal: tc.signal,
		})) {
			expect(message.value).toBe(1)
			break
		}
		await cancelled.promise
	} finally {
		release.resolve()
	}
})

test('rejects already-aborted unary calls with the original reason', async (tc) => {
	let calls = 0
	using peer = await serve({
		unary(_call, respond) {
			calls++
			respond(null, { value: 1 })
		},
	})
	let controller = new AbortController()
	let failure = new Error('cancelled by caller')
	controller.abort(failure)

	await expect(
		peer.client.unary({ value: 0 }, { signal: AbortSignal.any([tc.signal, controller.signal]) })
	).rejects.toBe(failure)
	await setTimeout(1, undefined, { signal: tc.signal })
	expect(calls).toBe(0)
})

test('rejects already-aborted client streams without consuming their producer', async (tc) => {
	using peer = await serve({})
	let consumed = false
	let controller = new AbortController()
	let failure = new Error('cancelled by caller')
	controller.abort(failure)
	async function* request() {
		consumed = true
		yield { value: 1 }
	}

	await expect(
		peer.client.client(request(), {
			signal: AbortSignal.any([tc.signal, controller.signal]),
		})
	).rejects.toBe(failure)
	expect(consumed).toBe(false)
})

test('rejects already-aborted response streams with AbortError', async (tc) => {
	using peer = await serve({})
	let controller = new AbortController()
	controller.abort(new Error('cancelled by caller'))

	await expect(
		collect(
			peer.client.server(
				{ value: 1 },
				{ signal: AbortSignal.any([tc.signal, controller.signal]) }
			)
		)
	).rejects.toMatchObject({
		name: 'AbortError',
	})
	await expect(
		collect(
			peer.client.bidi(messages(1), {
				signal: AbortSignal.any([tc.signal, controller.signal]),
			})
		)
	).rejects.toMatchObject({
		name: 'AbortError',
	})
})

test('cancels an active unary call with the original reason', async (tc) => {
	let started = Promise.withResolvers<void>()
	let cancelled = Promise.withResolvers<void>()
	using peer = await serve({
		unary(call) {
			call.on('cancelled', cancelled.resolve)
			started.resolve()
		},
	})
	let controller = new AbortController()
	let failure = new Error('cancelled by caller')
	let response = peer.client.unary(
		{ value: 1 },
		{ signal: AbortSignal.any([tc.signal, controller.signal]) }
	)

	await Promise.race([started.promise, response])
	controller.abort(failure)
	await expect(response).rejects.toBe(failure)
	await cancelled.promise
})

test('aborts a client stream while its request iterator is blocked', async (tc) => {
	let started = Promise.withResolvers<void>()
	let release = Promise.withResolvers<void>()
	let cancelled = Promise.withResolvers<void>()
	using peer = await serve({
		client(call) {
			call.on('cancelled', cancelled.resolve)
			call.on('data', started.resolve)
		},
	})
	async function* request() {
		yield { value: 1 }
		await release.promise
	}
	let controller = new AbortController()
	let failure = new Error('cancelled by caller')
	let response = peer.client.client(request(), {
		signal: AbortSignal.any([tc.signal, controller.signal]),
	})

	try {
		await Promise.race([started.promise, response])
		controller.abort(failure)
		await expect(response).rejects.toBe(failure)
		await cancelled.promise
	} finally {
		release.resolve()
	}
})

test('aborts bidi while its request iterator and response consumer are waiting', async (tc) => {
	let started = Promise.withResolvers<void>()
	let release = Promise.withResolvers<void>()
	let cancelled = Promise.withResolvers<void>()
	using peer = await serve({
		bidi(call) {
			call.on('cancelled', cancelled.resolve)
			call.on('data', started.resolve)
		},
	})
	async function* request() {
		yield { value: 1 }
		await release.promise
	}
	let controller = new AbortController()
	let responses = peer.client.bidi(request(), {
		signal: AbortSignal.any([tc.signal, controller.signal]),
	})
	let completion = collect(responses)

	try {
		await Promise.race([started.promise, completion])
		controller.abort(new Error('cancelled by caller'))
		await expect(completion).rejects.toMatchObject({ name: 'AbortError' })
		await cancelled.promise
	} finally {
		release.resolve()
	}
})

test('passes request metadata and reports unary headers and trailers', async (tc) => {
	let metadata = Metadata({
		'x-request': 'request',
		'x-data-bin': new Uint8Array([1, 2, 3]),
	})
	let headers: Metadata | undefined
	let trailers: Metadata | undefined
	let received: GrpcMetadata | undefined
	using peer = await serve({
		unary(call, respond) {
			received = call.metadata
			let header = new GrpcMetadata()
			header.set('x-header', 'header')
			call.sendMetadata(header)
			let trailer = new GrpcMetadata()
			trailer.set('x-trailer', 'trailer')
			respond(null, { value: 1 }, trailer)
		},
	})

	await peer.client.unary(
		{ value: 0 },
		{
			signal: tc.signal,
			metadata,
			onHeader(value) {
				headers = value
			},
			onTrailer(value) {
				trailers = value
			},
		}
	)
	expect(received?.get('x-request')).toEqual(['request'])
	expect(received?.get('x-data-bin')).toEqual([Buffer.from([1, 2, 3])])
	expect(headers?.get('x-header')).toBe('header')
	expect(trailers?.get('x-trailer')).toBe('trailer')
})

test('reports unary non-OK status and trailers as ClientError', async (tc) => {
	let trailers: Metadata | undefined
	using peer = await serve({
		unary(_call, respond) {
			let metadata = new GrpcMetadata()
			metadata.set('retry-info', 'later')
			respond({
				code: Status.RESOURCE_EXHAUSTED,
				details: 'capacity',
				metadata,
			})
		},
	})

	let response = peer.client.unary(
		{ value: 0 },
		{
			signal: tc.signal,
			onTrailer(value) {
				trailers = value
			},
		}
	)
	await expect(response).rejects.toBeInstanceOf(ClientError)
	await expect(response).rejects.toMatchObject({
		path: definition.unary.path,
		code: Status.RESOURCE_EXHAUSTED,
		details: 'capacity',
	})
	expect(trailers?.get('retry-info')).toBe('later')
})

test('reports streaming headers and non-OK trailers after delivered responses', async (tc) => {
	let headers: Metadata | undefined
	let trailers: Metadata | undefined
	using peer = await serve({
		server(call) {
			let header = new GrpcMetadata()
			header.set('x-header', 'header')
			call.sendMetadata(header)
			call.write({ value: 1 })
			setImmediate(() => {
				let metadata = new GrpcMetadata()
				metadata.set('x-trailer', 'trailer')
				call.emit('error', {
					code: Status.UNAVAILABLE,
					details: 'restart',
					metadata,
				})
			})
		},
	})
	let stream = peer.client.server(
		{ value: 0 },
		{
			signal: tc.signal,
			onHeader(value) {
				headers = value
			},
			onTrailer(value) {
				trailers = value
			},
		}
	)
	let responses = stream[Symbol.asyncIterator]()

	expect((await responses.next()).value?.value).toBe(1)
	let failure = responses.next()
	await expect(failure).rejects.toBeInstanceOf(ClientError)
	await expect(failure).rejects.toMatchObject({
		path: definition.server.path,
		code: Status.UNAVAILABLE,
		details: 'restart',
	})
	expect(headers?.get('x-header')).toBe('header')
	expect(trailers?.get('x-trailer')).toBe('trailer')
})

test('composes middleware with the last registered middleware outermost', async (tc) => {
	let events: string[] = []
	let first: ClientMiddleware = async function* (call, options) {
		events.push(`first:${call.method.path}`)
		let response = yield* call.next(call.request, options)
		events.push('first:return')
		return response
	}
	let second: ClientMiddleware = async function* (call, options) {
		events.push('second:start')
		let response = yield* call.next(call.request, options)
		events.push('second:return')
		return response
	}
	using peer = await serve({
		unary(call, respond) {
			events.push('server')
			respond(null, call.request)
		},
	})
	let client = createClient(definition, peer.channel, {}, composeClientMiddleware(first, second))

	expect((await client.unary({ value: 1 }, { signal: tc.signal })).value).toBe(1)
	expect(events).toEqual([
		'second:start',
		'first:/test.Transport/Unary',
		'server',
		'first:return',
		'second:return',
	])
})

test('merges global and method defaults before per-call options', async (tc) => {
	let values: (string | undefined)[] = []
	let middleware: ClientMiddleware = async function* (call, options) {
		values.push(options.metadata?.get('x-source'))
		return yield* call.next(call.request, options)
	}
	using peer = await serve({
		unary(call, respond) {
			respond(null, call.request)
		},
		server(call) {
			call.end()
		},
	})
	let client = createClient(
		definition,
		peer.channel,
		{
			'*': {
				signal: tc.signal,
				metadata: Metadata({ 'x-source': 'global' }),
			},
			unary: { metadata: Metadata({ 'x-source': 'method' }) },
		},
		middleware
	)

	await collect(client.server({ value: 1 }))
	await client.unary({ value: 1 })
	await client.unary({ value: 1 }, { metadata: Metadata({ 'x-source': 'call' }) })
	expect(values).toEqual(['global', 'method', 'call'])
})

test('rejects a unary middleware that yields its response', async (tc) => {
	let middleware: ClientMiddleware = async function* (call, options) {
		if (call.responseStream) {
			return yield* call.next(call.request, options)
		}

		let response = yield* call.next(call.request, options)
		yield response
		return response
	}
	using peer = await serve({
		unary(call, respond) {
			respond(null, call.request)
		},
	})
	let client = createClient(definition, peer.channel, {}, middleware)

	await expect(client.unary({ value: 1 }, { signal: tc.signal })).rejects.toThrow(
		'A middleware yielded'
	)
})

test('rejects a unary middleware that returns no response', async (tc) => {
	let middleware: ClientMiddleware = async function* (call, options) {
		yield* call.next(call.request, options)
	}
	using peer = await serve({
		unary(call, respond) {
			respond(null, call.request)
		},
	})
	let client = createClient(definition, peer.channel, {}, middleware)

	await expect(client.unary({ value: 1 }, { signal: tc.signal })).rejects.toThrow(
		'A middleware returned void'
	)
})

test('preserves concurrent calls when an external serializer reuses its scratch buffer', async (tc) => {
	let scratch = Buffer.alloc(4)
	using peer = await serve({
		unary(call, respond) {
			respond(null, call.request)
		},
	})
	let client = createClient(
		{
			unary: {
				...definition.unary,
				requestSerialize(message: Message) {
					scratch.writeUInt32LE(message.value)
					return scratch
				},
			},
		},
		peer.channel
	)
	let expected = Array.from({ length: 32 }, (_, index) => index)

	let responses = await Promise.all(
		expected.map((value) => client.unary({ value }, { signal: tc.signal }))
	)
	expect(responses.map((response) => response.value)).toEqual(expected)
})

test('uses the exact byte range of an owned serialized request', async (tc) => {
	using peer = await serve({
		unary(call, respond) {
			respond(null, call.request)
		},
	})
	let client = createClient(
		{
			unary: {
				...definition.unary,
				requestBufferOwned: true,
				requestSerialize(message: Message) {
					let bytes = new Uint8Array(12).fill(0xff)
					new DataView(bytes.buffer).setUint32(3, message.value, true)
					return bytes.subarray(3, 7)
				},
			},
		},
		peer.channel
	)

	let response = await client.unary({ value: 42 }, { signal: tc.signal })
	expect(response.value).toBe(42)
	expect(response.padding?.byteLength).toBe(0)
})

test('aborts a server stream while waiting for its next response', async (tc) => {
	let cancelled = Promise.withResolvers<void>()
	using peer = await serve({
		server(call) {
			call.on('cancelled', cancelled.resolve)
			call.write({ value: 1 })
		},
	})
	let controller = new AbortController()
	let stream = peer.client.server(
		{ value: 0 },
		{ signal: AbortSignal.any([tc.signal, controller.signal]) }
	)
	let responses = stream[Symbol.asyncIterator]()

	expect((await responses.next()).value?.value).toBe(1)
	let next = responses.next()
	controller.abort(new Error('cancelled by caller'))
	await expect(next).rejects.toMatchObject({ name: 'AbortError' })
	await cancelled.promise
})

test('completes unary and client streaming calls without Promise.withResolvers', async (tc) => {
	using peer = await serve({
		unary(call, respond) {
			respond(null, call.request)
		},
		client(call, respond) {
			let sum = 0
			call.on('data', (message: Message) => {
				sum += message.value
			})
			call.on('end', () => {
				respond(null, { value: sum })
			})
		},
	})
	let descriptor = Object.getOwnPropertyDescriptor(Promise, 'withResolvers')!
	let responses: Message[]

	Object.defineProperty(Promise, 'withResolvers', { ...descriptor, value: undefined })
	try {
		responses = await Promise.all([
			peer.client.unary({ value: 7 }, { signal: tc.signal }),
			peer.client.client(messages(1, 2, 3), { signal: tc.signal }),
		])
	} finally {
		Object.defineProperty(Promise, 'withResolvers', descriptor)
	}

	expect(responses.map((response) => response.value)).toEqual([7, 6])
})

test('preserves channel protocols, explicit ports and credential-based default ports', () => {
	let cases = [
		{ address: 'localhost', expected: 'dns:localhost:80' },
		{ address: 'http://localhost', expected: 'dns:localhost:80' },
		{ address: 'http://localhost:80', expected: 'dns:localhost:80' },
		{ address: 'https://localhost', expected: 'dns:localhost:443' },
		{ address: 'https://localhost:443', expected: 'dns:localhost:443' },
		{ address: 'localhost:2135', expected: 'dns:localhost:2135' },
		{ address: 'https://localhost:2135', expected: 'dns:localhost:2135' },
		{
			address: 'localhost',
			credentials: credentials.createSsl(),
			expected: 'dns:localhost:443',
		},
		{
			address: 'localhost',
			credentials: credentials.createInsecure(),
			expected: 'dns:localhost:80',
		},
		{ address: 'dns:///localhost:2135', expected: 'dns:///localhost:2135' },
		{ address: 'unix:///tmp/ydb.sock', expected: 'unix:///tmp/ydb.sock' },
	]

	for (let entry of cases) {
		let channel = createChannel(entry.address, entry.credentials)
		try {
			expect(channel.getTarget()).toBe(entry.expected)
		} finally {
			channel.close()
		}
	}
})
