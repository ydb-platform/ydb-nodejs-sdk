import { type Http2Session } from 'node:http2'

import { expect, test } from 'vitest'

import { deferred, frame, rawServer, service } from '../tests/fixtures.ts'
import { Client } from './client.ts'

async function ping(session: Http2Session): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		session.ping((error) => {
			if (error) {
				reject(error)
			} else {
				resolve()
			}
		})
	})
}

// Protocol faults after accepted data require a controlled peer; YDB cannot schedule them deterministically.
for (let [name, tail, details] of [
	['malformed next frame', Buffer.from([2, 0, 0, 0, 0]), 'Invalid gRPC compression flag'],
	['truncated next frame', frame('truncated').subarray(0, 7), 'Truncated gRPC message'],
] as const) {
	test(`preserves the current response batch before a ${name}`, async (tc) => {
		let finish = deferred<() => Promise<void>>()
		let terminal = deferred()
		await using peer = await rawServer((stream) => {
			let session = stream.session!
			stream.respond(
				{ ':status': 200, 'content-type': 'application/grpc' },
				{ waitForTrailers: true }
			)
			stream.on('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0' }))
			stream.write(Buffer.concat([frame('first'), frame('second')]))
			finish.resolve(async () => {
				stream.end(tail)
				await ping(session)
			})
		})
		using client = new Client(peer.authority)
		let response = client.call(service.serverStream, '', {
			signal: tc.signal,
			onStatus: () => terminal.resolve(),
		})
		let iterator = response[Symbol.asyncIterator]()

		expect((await iterator.next()).value).toBe('first')
		let sendTail = await finish.promise
		await sendTail()
		if (name === 'truncated next frame') {
			await terminal.promise
		}
		expect((await iterator.next()).value).toBe('second')
		await expect(iterator.next()).rejects.toMatchObject({ code: 13, details })
	})
}

test('preserves the decompression error and cause after accepted responses', async (tc) => {
	let finish = deferred<() => Promise<void>>()
	await using peer = await rawServer((stream) => {
		let session = stream.session!
		stream.respond(
			{ ':status': 200, 'content-type': 'application/grpc', 'grpc-encoding': 'gzip' },
			{ waitForTrailers: true }
		)
		stream.on('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0' }))
		stream.write(Buffer.concat([frame('first'), frame('second')]))
		finish.resolve(async () => {
			stream.end(frame('invalid gzip', true))
			await ping(session)
		})
	})
	using client = new Client(peer.authority)
	let response = client.call(service.serverStream, '', { signal: tc.signal })
	let iterator = response[Symbol.asyncIterator]()

	expect((await iterator.next()).value).toBe('first')
	let sendTail = await finish.promise
	await sendTail()
	expect((await iterator.next()).value).toBe('second')
	await expect(iterator.next()).rejects.toMatchObject({
		code: 13,
		details: 'Failed to decompress gRPC message',
		cause: { code: 'Z_DATA_ERROR' },
	})
})

test('cancels a read while the frame body is incomplete', async (tc) => {
	let started = deferred()
	await using peer = await rawServer((stream) => {
		stream.respond({ ':status': 200, 'content-type': 'application/grpc' })
		stream.write(frame('incomplete body').subarray(0, 6))
		started.resolve()
	})
	using client = new Client(peer.authority)
	let controller = new AbortController()
	let reason = new Error('cancel partial response')
	let response = client.call(service.serverStream, '', {
		signal: AbortSignal.any([tc.signal, controller.signal]),
	})
	let iterator = response[Symbol.asyncIterator]()
	let pending = iterator.next()
	let failure = pending.catch((error: unknown) => error)
	await started.promise
	await ping(peer.sessions[0]!)

	controller.abort(reason)

	expect(await failure).toBe(reason)
})

test('settles a pending response read when the HTTP/2 session closes prematurely', async (tc) => {
	let reset = deferred<() => void>()
	await using peer = await rawServer((stream) => {
		stream.respond({ ':status': 200, 'content-type': 'application/grpc' })
		stream.write(frame('first'))
		reset.resolve(() => stream.session?.destroy())
	})
	using client = new Client(peer.authority)
	let response = client.call(service.serverStream, '', { signal: tc.signal })
	let iterator = response[Symbol.asyncIterator]()
	expect((await iterator.next()).value).toBe('first')
	let pending = iterator.next()
	let failure = pending.catch((error: unknown) => error)
	let resetStream = await reset.promise

	resetStream()

	expect(await failure).toMatchObject({ code: 14 })
})
