import { constants } from 'node:http2'
import { setTimeout } from 'node:timers/promises'

import { expect, test } from 'vitest'

import { deferred, rawServer } from '../tests/fixtures.ts'
import { Client } from './client.ts'

// A peer can reject frequent pings without rejecting an RPC; the next connection must retain that feedback.
test('increases the next connection ping interval after too_many_pings GOAWAY', async (tc) => {
	let firstClosed = deferred()
	let secondPing = deferred()
	let connections = 0
	await using peer = await rawServer(() => {})
	peer.server.on('session', (session) => {
		connections++
		let connection = connections
		session.once('ping', () => {
			if (connection === 1) {
				session.once('close', firstClosed.resolve)
				session.goaway(
					constants.NGHTTP2_ENHANCE_YOUR_CALM,
					0,
					Buffer.from('too_many_pings')
				)
				session.close()
			} else {
				secondPing.resolve()
			}
		})
	})
	let options = { keepaliveIntervalMs: 40, keepaliveTimeoutMs: 1000 }
	using client = new Client(peer.authority, options)
	await client.connect(tc.signal)
	await firstClosed.promise
	let started = performance.now()

	await client.connect(tc.signal)
	await secondPing.promise

	expect(performance.now() - started).toBeGreaterThanOrEqual(60)
	expect(connections).toBe(2)
	expect(options.keepaliveIntervalMs).toBe(40)
})

test('caps ping backoff before a Node timer can overflow to one millisecond', async (tc) => {
	let pings = 0
	await using peer = await rawServer(() => {})
	peer.server.on('session', (session) => {
		session.on('ping', () => {
			pings++
		})
	})
	using client = new Client(peer.authority, { keepaliveIntervalMs: 1_500_000_000 })
	await client.connect(tc.signal)
	let first = peer.sessions[0]!
	let closed = deferred()
	first.once('close', closed.resolve)
	first.goaway(constants.NGHTTP2_ENHANCE_YOUR_CALM, 0, Buffer.from('too_many_pings'))
	first.close()
	await closed.promise

	await client.connect(tc.signal)
	await setTimeout(50, undefined, { signal: tc.signal })

	expect(pings).toBe(0)
	expect(peer.sessions).toHaveLength(2)
})
