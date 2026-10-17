import { addAbortListener, once } from 'node:events'
import { type IncomingHttpHeaders, type OutgoingHttpHeaders, connect, constants } from 'node:http2'
import { createConnection } from 'node:net'
import { setImmediate, setTimeout } from 'node:timers/promises'
import { gzipSync } from 'node:zlib'

import { expect, test } from 'vitest'

import { frame, service as methods } from '../tests/fixtures.ts'
import { Client } from './client.ts'
import { RpcError, Status } from './error.ts'
import { Server } from './server.ts'
import { createServiceClient } from './service.ts'

let service = {
	unary: methods.unary,
	serverStream: { ...methods.serverStream, responseStream: true as const },
	clientStream: { ...methods.clientStream, requestStream: true as const },
}

// Raw requests exercise malformed input that a typed service client cannot produce.
async function request(
	port: number,
	body: Uint8Array,
	signal: AbortSignal,
	headers: OutgoingHttpHeaders = {}
) {
	let session = connect(`http://127.0.0.1:${port}`)
	try {
		let stream = session.request(
			{
				':method': 'POST',
				':path': service.unary.path,
				'content-type': 'application/grpc',
				...headers,
			},
			{ endStream: false, signal }
		)
		let received: IncomingHttpHeaders = {}
		let chunks: Buffer[] = []
		stream.on('response', (value) => Object.assign(received, value))
		stream.on('trailers', (value) => Object.assign(received, value))
		stream.end(body)
		for await (let chunk of stream) chunks.push(chunk as Buffer)
		return { headers: received, body: Buffer.concat(chunks) }
	} finally {
		session.destroy()
	}
}

test.for([
	{ headers: { ':method': 'GET' }, status: 405 },
	{ headers: { 'content-type': 'application/json' }, status: 415 },
])('rejects an unsupported HTTP request with $status', async ({ headers, status }, tc) => {
	await using server = new Server()
	let calls = 0
	server.add(service, { unary: () => String(++calls) })
	let port = await server.listen()

	let response = await request(port, frame('request'), tc.signal, headers)

	expect(response.headers[':status']).toBe(status)
	expect(calls).toBe(0)
})

test('returns UNIMPLEMENTED for an unregistered RPC', async (tc) => {
	await using server = new Server()
	let port = await server.listen()

	let response = await request(port, frame('request'), tc.signal)

	expect(response.headers[':status']).toBe(200)
	expect(response.headers['grpc-status']).toBe(String(Status.UNIMPLEMENTED))
})

let invalidFlag = frame('request')
invalidFlag[0] = 2
let oversizedHeader = Buffer.alloc(5)
oversizedHeader.writeUInt32BE(1024, 1)

test.for([
	{ name: 'missing message', body: Buffer.alloc(0), code: Status.INTERNAL },
	{
		name: 'multiple unary messages',
		body: Buffer.concat([frame('a'), frame('b')]),
		code: Status.INTERNAL,
	},
	{ name: 'truncated header', body: Buffer.from([0, 0, 0]), code: Status.INTERNAL },
	{ name: 'truncated body', body: frame('abc').subarray(0, 6), code: Status.INTERNAL },
	{ name: 'invalid compression flag', body: invalidFlag, code: Status.INTERNAL },
	{ name: 'oversized advertised body', body: oversizedHeader, code: Status.RESOURCE_EXHAUSTED },
	{
		name: 'oversized decompressed body',
		body: frame(gzipSync('x'.repeat(1024)), true),
		code: Status.RESOURCE_EXHAUSTED,
		encoding: 'gzip',
	},
	{
		name: 'corrupt compressed body',
		body: frame('invalid gzip', true),
		code: Status.INTERNAL,
		encoding: 'gzip',
	},
	{
		name: 'undeclared compression',
		body: frame(gzipSync('request'), true),
		code: Status.INTERNAL,
	},
	{
		name: 'unsupported compression',
		body: frame(gzipSync('request'), true),
		code: Status.UNIMPLEMENTED,
		encoding: 'br',
	},
])('rejects $name before calling a unary handler', async ({ body, code, encoding }, tc) => {
	await using server = new Server({ maxReceiveBytes: 64 })
	let calls = 0
	server.add(service, { unary: () => String(++calls) })
	let port = await server.listen()

	let response = await request(
		port,
		body,
		tc.signal,
		encoding ? { 'grpc-encoding': encoding } : {}
	)

	expect(response.headers['grpc-status']).toBe(String(code))
	expect(calls).toBe(0)
})

test('decodes a compressed request before invoking its handler', async (tc) => {
	await using server = new Server()
	server.add(service, { unary: (value) => value })
	let port = await server.listen()

	let response = await request(port, frame(gzipSync('request'), true), tc.signal, {
		'grpc-encoding': 'gzip',
	})

	expect(response.headers['grpc-status']).toBe(String(Status.OK))
	expect(response.body).toEqual(frame('request'))
})

test('rejects invalid binary request metadata before invoking its handler', async (tc) => {
	await using server = new Server()
	let calls = 0
	server.add(service, { unary: () => String(++calls) })
	let port = await server.listen()

	let response = await request(port, frame('request'), tc.signal, { 'x-data-bin': '!' })

	expect(response.headers['grpc-status']).toBe(String(Status.INVALID_ARGUMENT))
	expect(calls).toBe(0)
})

test.for(['sendHeader', 'setTrailer'] as const)(
	'returns a gRPC error when a handler passes invalid metadata to %s',
	async (operation, tc) => {
		await using server = new Server()
		server.add(service, {
			unary(_request, context) {
				context[operation]({ 'x-data-bin': 'not bytes' })
				return 'response'
			},
		})
		let port = await server.listen()

		let response = await request(port, frame('request'), tc.signal)

		expect(response.headers['grpc-status']).toBe(String(Status.UNKNOWN))
		expect(decodeURIComponent(String(response.headers['grpc-message']))).toMatch(
			/Binary metadata/
		)
	}
)

test('returns INTERNAL when a thrown status contains invalid metadata', async (tc) => {
	await using server = new Server()
	server.add(service, {
		unary() {
			throw new RpcError(Status.PERMISSION_DENIED, 'denied', { 'x-data-bin': 'not bytes' })
		},
	})
	let port = await server.listen()

	let response = await request(port, frame('request'), tc.signal)

	expect(response.headers['grpc-status']).toBe(String(Status.INTERNAL))
})

test('rejects an oversized serialized response without sending its body', async (tc) => {
	await using server = new Server({ maxSendBytes: 8 })
	server.add(service, { unary: () => 'x'.repeat(9) })
	let port = await server.listen()

	let response = await request(port, frame('request'), tc.signal)

	expect(response.headers['grpc-status']).toBe(String(Status.RESOURCE_EXHAUSTED))
	expect(response.body.length).toBe(0)
})

test('drains an active RPC before graceful close completes', async (tc) => {
	await using server = new Server()
	let started = Promise.withResolvers<void>()
	let release = Promise.withResolvers<void>()
	server.add(service, {
		async unary() {
			started.resolve()
			await release.promise
			return 'completed'
		},
	})
	let port = await server.listen()
	let session = connect(`http://127.0.0.1:${port}`)
	try {
		let stream = session.request(
			{ ':method': 'POST', ':path': service.unary.path, 'content-type': 'application/grpc' },
			{ signal: tc.signal }
		)
		let chunks: Buffer[] = []
		stream.on('data', (chunk: Buffer) => chunks.push(chunk))
		let ended = once(stream, 'end', { signal: tc.signal })
		stream.end(frame('request'))
		await started.promise
		let goaway = once(session, 'goaway', { signal: tc.signal })
		let closed = false
		let closing = server.close().then(() => {
			closed = true
			return undefined
		})
		await goaway
		expect(closed).toBe(false)
		release.resolve()
		await ended
		await closing
		expect(Buffer.concat(chunks)).toEqual(frame('completed'))
		expect(closed).toBe(true)
	} finally {
		release.resolve()
		session.destroy()
	}
})

test('aborts an active handler when destroyed', async (tc) => {
	await using server = new Server()
	let started = Promise.withResolvers<AbortSignal>()
	let cancelled = Promise.withResolvers<void>()
	server.add(service, {
		async unary(_request, context) {
			started.resolve(context.signal)
			await once(context.signal, 'abort')
			cancelled.resolve()
			return 'late response'
		},
	})
	let port = await server.listen()
	using transport = new Client(`http://127.0.0.1:${port}`)
	let client = createServiceClient(service, transport)
	let response = client.unary('request', { signal: tc.signal })
	let failure = response.catch((error: unknown) => error)
	let signal = await started.promise

	server.destroy()
	await server.close()
	await cancelled.promise

	expect(signal.aborted).toBe(true)
	expect(await failure).toBeInstanceOf(Error)
})

test('destroys a TCP connection before its TLS handshake completes', async (tc) => {
	await using server = new Server({ tls: {} })
	let port = await server.listen()
	let socket = createConnection({ host: '127.0.0.1', port })
	let cancellation = addAbortListener(tc.signal, () => socket.destroy())
	let failure: NodeJS.ErrnoException | undefined
	socket.on('error', (error) => {
		failure = error
	})
	try {
		await once(socket, 'connect', { signal: tc.signal })
		await setImmediate()
		let disconnected = new Promise<void>((resolve) => socket.once('close', () => resolve()))

		server.destroy()
		await disconnected
		tc.signal.throwIfAborted()
		await server.close()

		expect(socket.destroyed).toBe(true)
		expect([undefined, 'ECONNRESET']).toContain(failure?.code)
	} finally {
		cancellation[Symbol.dispose]()
		// A deliberate reset can make Socket.asyncDispose() reject with ECONNRESET.
		socket.destroy()
	}
})

test('bounds response production while the peer gives no HTTP/2 flow credit', async (tc) => {
	await using server = new Server()
	let produced = 0
	let stopped = Promise.withResolvers<void>()
	let body = 'x'.repeat(128 * 1024)
	server.add(service, {
		async *serverStream() {
			try {
				for (let i = 0; i < 256; i++) {
					produced++
					yield body
				}
			} finally {
				stopped.resolve()
			}
		},
	})
	let port = await server.listen()
	let session = connect(`http://127.0.0.1:${port}`, { settings: { initialWindowSize: 0 } })
	try {
		let stream = session.request(
			{
				':method': 'POST',
				':path': service.serverStream.path,
				'content-type': 'application/grpc',
			},
			{ signal: tc.signal }
		)
		let accepted = once(stream, 'response', { signal: tc.signal })
		stream.end(frame('request'))
		await accepted
		await setTimeout(20, undefined, { signal: tc.signal })
		expect(produced).toBeGreaterThan(0)
		expect(produced).toBeLessThan(256)
		stream.close(constants.NGHTTP2_CANCEL)
		await stopped.promise
	} finally {
		session.destroy()
	}
})

test('preserves DEADLINE_EXCEEDED when a response is blocked on flow control', async (tc) => {
	await using server = new Server()
	let started = Promise.withResolvers<AbortSignal>()
	server.add(service, {
		async *serverStream(_request, context) {
			started.resolve(context.signal)
			yield 'x'.repeat(128 * 1024)
		},
	})
	let port = await server.listen()
	let session = connect(`http://127.0.0.1:${port}`, { settings: { initialWindowSize: 0 } })
	try {
		let stream = session.request(
			{
				':method': 'POST',
				':path': service.serverStream.path,
				'content-type': 'application/grpc',
				'grpc-timeout': '50m',
			},
			{ signal: tc.signal }
		)
		let trailers: IncomingHttpHeaders | undefined
		stream.on('trailers', (value) => {
			trailers = value
		})
		let ended = once(stream, 'end', { signal: tc.signal })
		stream.resume()
		stream.end(frame('request'))
		let signal = await started.promise
		await once(signal, 'abort', { signal: tc.signal })
		session.settings({ initialWindowSize: 256 * 1024 })
		await ended

		expect(trailers?.['grpc-status']).toBe(String(Status.DEADLINE_EXCEEDED))
	} finally {
		session.destroy()
	}
})

test('interrupts a handler waiting for another request at its deadline', async (tc) => {
	await using server = new Server()
	let finished = Promise.withResolvers<{ error: unknown; reason: unknown }>()
	let received: string[] = []
	server.add(service, {
		async clientStream(requests, context) {
			try {
				for await (let value of requests) received.push(value)
				return 'unexpected completion'
			} catch (error) {
				finished.resolve({ error, reason: context.signal.reason })
				throw error
			}
		},
	})
	let port = await server.listen()
	let session = connect(`http://127.0.0.1:${port}`)
	try {
		let stream = session.request(
			{
				':method': 'POST',
				':path': service.clientStream.path,
				'content-type': 'application/grpc',
				'grpc-timeout': '50m',
			},
			{ signal: tc.signal }
		)
		let headers: IncomingHttpHeaders | undefined
		stream.on('response', (value) => {
			headers = value
		})
		let ended = once(stream, 'end', { signal: tc.signal })
		stream.resume()
		stream.write(frame('first request'))
		await ended
		let { error, reason } = await finished.promise

		expect(headers?.['grpc-status']).toBe(String(Status.DEADLINE_EXCEEDED))
		expect(received).toEqual(['first request'])
		expect(error).toBe(reason)
	} finally {
		session.destroy()
	}
})
