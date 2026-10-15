import { constants, createServer } from 'node:http2'

import { expect, test } from 'vitest'

import { collect, deferred, rawServer, reply, requests, service } from '../tests/fixtures.ts'
import { Client } from './client.ts'
import { Status } from './error.ts'

// The peer controls flow windows and reset ordering, which real YDB cannot reproduce deterministically.

test('receives concurrent response headers while a large request is blocked by flow control', async (tc) => {
	let firstStarted = deferred()
	let secondStarted = deferred<() => void>()
	let send = deferred()
	let serialized = deferred()
	let payload = new Uint8Array(16 * 1024 * 1024)
	await using peer = await rawServer(
		(stream, headers) => {
			if (headers[':path'] === '/test.Transport/Large') {
				firstStarted.resolve()
			} else {
				secondStarted.resolve(() => reply(stream, ['concurrent response']))
			}
		},
		createServer({ settings: { initialWindowSize: 0 } })
	)
	using client = new Client(peer.authority)
	let controller = new AbortController()
	let reason = new Error('stop blocked request')
	async function* input() {
		await send.promise
		yield payload
	}
	let blocked = collect(
		client.call(
			{
				...service.bidi,
				path: '/test.Transport/Large',
				requestSerialize(value: Uint8Array) {
					serialized.resolve()
					return value
				},
			},
			input(),
			{ signal: AbortSignal.any([tc.signal, controller.signal]) }
		)
	).catch((error: unknown) => error)
	await firstStarted.promise
	let response = collect(client.call(service.unary, '', { signal: tc.signal }))
	let respond = await secondStarted.promise
	send.resolve()
	await serialized.promise
	respond()

	await expect(response).resolves.toEqual(['concurrent response'])
	expect(peer.sessions).toHaveLength(1)
	controller.abort(reason)
	expect(await blocked).toBe(reason)
	expect(peer.errors).toEqual([])
})

for (let [name, reset, status] of [
	['refused stream', constants.NGHTTP2_REFUSED_STREAM, Status.UNAVAILABLE],
	['cancellation', constants.NGHTTP2_CANCEL, Status.CANCELLED],
	['resource exhaustion', constants.NGHTTP2_ENHANCE_YOUR_CALM, Status.RESOURCE_EXHAUSTED],
	['inadequate security', constants.NGHTTP2_INADEQUATE_SECURITY, Status.PERMISSION_DENIED],
	['protocol error', constants.NGHTTP2_PROTOCOL_ERROR, Status.INTERNAL],
	['flow control error', constants.NGHTTP2_FLOW_CONTROL_ERROR, Status.INTERNAL],
	['internal error', constants.NGHTTP2_INTERNAL_ERROR, Status.INTERNAL],
] as const) {
	for (let streaming of [false, true]) {
		test(`maps HTTP/2 ${name} after ${streaming ? 'streaming' : 'unary'} requests`, async (tc) => {
			await using peer = await rawServer(async (stream) => {
				if (streaming) {
					stream.once('data', () => stream.close(reset))
				} else {
					await requests(stream)
					stream.close(reset)
				}
			})
			using client = new Client(peer.authority)
			let release = deferred()
			async function* input() {
				yield 'request'
				await release.promise
			}
			let statuses: number[] = []
			try {
				await expect(
					collect(
						client.call(
							streaming ? service.bidi : service.unary,
							streaming ? input() : 'request',
							{
								signal: tc.signal,
								onStatus: (result) => statuses.push(result.code),
							}
						)
					)
				).rejects.toMatchObject({ code: status })
				expect(statuses).toEqual([status])
			} finally {
				release.resolve()
			}
		})
	}
}

for (let status of [Status.OK, Status.PERMISSION_DENIED]) {
	test(`preserves terminal gRPC status ${status} after an HTTP/2 reset`, async (tc) => {
		let trailers = deferred()
		let release = deferred()
		await using peer = await rawServer((stream) =>
			reply(stream, ['value'], {}, { 'grpc-status': String(status) })
		)
		using client = new Client(peer.authority)
		async function* input() {
			yield 'request'
			await release.promise
		}
		let response = client.call(service.bidi, input(), {
			signal: tc.signal,
			onTrailer: () => trailers.resolve(),
		})
		let responses = response[Symbol.asyncIterator]()
		try {
			expect((await responses.next()).value).toBe('value')
			await trailers.promise
			peer.streams[0]!.close(constants.NGHTTP2_INTERNAL_ERROR)
			await new Promise<void>((resolve, reject) => {
				peer.sessions[0]!.ping((error) => {
					if (error) {
						reject(error)
					} else {
						resolve()
					}
				})
			})
			let terminal = await responses.next().then(
				(result) => ({ done: result.done, code: Status.OK }),
				(error) => ({ done: true, code: error.code })
			)
			expect(terminal).toEqual({ done: true, code: status })
		} finally {
			release.resolve()
		}
	})
}
