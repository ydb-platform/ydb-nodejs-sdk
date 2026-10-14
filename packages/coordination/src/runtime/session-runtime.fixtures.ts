import { setImmediate } from 'node:timers/promises'
import { Duplex } from 'node:stream'
import type { SessionResponse } from '@ydbjs/api/coordination'
import type { Driver } from '@ydbjs/core'

import { createDeferred } from './session-registry.ts'
import type { SessionRuntime, SessionStatus } from './session-runtime.ts'

// ── fake stream infrastructure ─────────────────────────────────────────────────

// A handle returned to the test for each stream instance the runtime opens.
export type FakeStreamHandle = {
	/** Push a server response message into the open stream. */
	respond(response: SessionResponse): void
	/** End the stream as if the transport was lost. */
	disconnect(): void
}

export type FakeDriverHandle = {
	driver: Driver
	/**
	 * Returns a promise that resolves with the handle for the next stream the
	 * runtime opens.  Call this before OR after the runtime opens the stream —
	 * the implementation queues handles either way.
	 */
	waitForNextStream(): Promise<FakeStreamHandle>
}

export let makeFakeDriver = function makeFakeDriver(): FakeDriverHandle {
	// Supports either ordering: the test can wait before or after session() is called.
	let pendingHandles: FakeStreamHandle[] = []
	let pendingWaiters: Array<(handle: FakeStreamHandle) => void> = []

	let waitForNextStream = function waitForNextStream(): Promise<FakeStreamHandle> {
		if (pendingHandles.length > 0) {
			return Promise.resolve(pendingHandles.shift()!)
		}
		let deferred = createDeferred<FakeStreamHandle>()
		pendingWaiters.push(deferred.resolve)
		return deferred.promise
	}

	let deliverHandle = function deliverHandle(handle: FakeStreamHandle): void {
		if (pendingWaiters.length > 0) {
			pendingWaiters.shift()!(handle)
		} else {
			pendingHandles.push(handle)
		}
	}

	let driver = {
		createClient(): unknown {
			return {
				session() {
					let stream = Object.assign(
						new Duplex({
							objectMode: true,
							read() {},
							write(_message, _encoding, callback) {
								callback()
							},
						}),
						{
							cancel() {
								stream.destroy()
							},
						}
					)
					deliverHandle({
						respond(response) {
							if (!stream.destroyed && !stream.readableEnded) {
								stream.push(response)
							}
						},
						disconnect() {
							stream.push(null)
						},
					})
					return stream
				},
			}
		},
	} as unknown as Driver

	return { driver, waitForNextStream }
}

// ── protocol response helpers ──────────────────────────────────────────────────

export let sessionStartedResponse = function sessionStartedResponse(
	sessionId: bigint
): SessionResponse {
	return {
		response: { case: 'sessionStarted', value: { sessionId } },
	} as unknown as SessionResponse
}

export let sessionStoppedResponse = function sessionStoppedResponse(): SessionResponse {
	return { response: { case: 'sessionStopped', value: {} } } as unknown as SessionResponse
}

// ── async helpers ──────────────────────────────────────────────────────────────

// Flush the microtask queue by chaining many Promise.resolve() ticks.
export let settle = async function settle(ticks = 100): Promise<void> {
	for (let i = 0; i < ticks; i++) {
		// oxlint-disable-next-line no-await-in-loop
		await Promise.resolve()
	}
	await setImmediate()
}

// Yield to the macrotask queue (timers, I/O callbacks) once.
// Unlike Promise.resolve() microtasks, setImmediate yields between event loop
// phases so that pending setTimeout callbacks (retry backoff, recovery window)
// get a chance to fire before we resume.
export let tick = function tick(): Promise<void> {
	let deferred = createDeferred<void>()
	setTimeout(deferred.resolve, 0)
	return deferred.promise
}

// Poll until the session reaches the expected status, then run additional
// settle ticks so that async effects scheduled on that transition (such as
// finalizeRuntime) also have a chance to complete before assertions run.
//
// Uses setImmediate-based yields (not Promise microtasks) so that real timer
// callbacks (setTimeout for retryBackoff / recoveryWindow) can fire while we
// are waiting.
export let waitForStatus = async function waitForStatus(
	runtime: SessionRuntime,
	expected: SessionStatus,
	maxTicks = 1000
): Promise<void> {
	for (let i = 0; i < maxTicks; i++) {
		if (runtime.status === expected) {
			// Extra settle: the FSM state changes synchronously during dispatch but
			// the effects (e.g. markClosed → finalizeRuntime → signalController.abort)
			// run asynchronously.  Give them time to complete before returning.

			// oxlint-disable-next-line no-await-in-loop
			await settle()

			return
		}
		// oxlint-disable-next-line no-await-in-loop
		await tick()
	}
	if (runtime.status !== expected) {
		throw new Error(
			`Status "${expected}" not reached after ${maxTicks} ticks; current: "${runtime.status}"`
		)
	}
}
