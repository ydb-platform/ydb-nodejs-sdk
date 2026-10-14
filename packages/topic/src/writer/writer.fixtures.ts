import { setImmediate } from 'node:timers/promises'
import { Duplex } from 'node:stream'
import { StatusIds_StatusCode } from '@ydbjs/api/operation'
import type {
	StreamWriteMessage_FromClient,
	StreamWriteMessage_FromServer,
	StreamWriteMessage_InitRequest,
	StreamWriteMessage_WriteRequest,
} from '@ydbjs/api/topic'
import type { Driver } from '@ydbjs/core'

import type { AckStatus } from './types.js'

// A handle to one streamWrite the writer opened. Lets the test drive the server
// side (respond / disconnect) and inspect what the writer sent (init / writes).
export type FakeWriteStream = {
	respond(message: StreamWriteMessage_FromServer): void
	disconnect(): void
	fail(error: unknown): void
	// True once the writer aborted this stream's signal (i.e. tore the stream down).
	wasAborted(): boolean
	sent: StreamWriteMessage_FromClient[]
	waitForInit(): Promise<StreamWriteMessage_InitRequest>
	waitForWrite(): Promise<StreamWriteMessage_WriteRequest>
}

export type FakeTopicDriver = {
	driver: Driver
	waitForNextStream(): Promise<FakeWriteStream>
}

let deferred = function deferred<T>(): PromiseWithResolvers<T> {
	return Promise.withResolvers<T>()
}

export let makeFakeTopicDriver = function makeFakeTopicDriver(): FakeTopicDriver {
	let pendingHandles: FakeWriteStream[] = []
	let pendingWaiters: Array<(handle: FakeWriteStream) => void> = []

	let waitForNextStream = function waitForNextStream(): Promise<FakeWriteStream> {
		if (pendingHandles.length > 0) {
			return Promise.resolve(pendingHandles.shift()!)
		}
		let d = deferred<FakeWriteStream>()
		pendingWaiters.push(d.resolve)
		return d.promise
	}

	let deliver = function deliver(handle: FakeWriteStream): void {
		if (pendingWaiters.length > 0) {
			pendingWaiters.shift()!(handle)
		} else {
			pendingHandles.push(handle)
		}
	}

	let driver = {
		identity: { database: '/local', address: 'localhost', port: 2136 },
		ready: () => Promise.resolve(),
		get token(): Promise<string> {
			return Promise.resolve('fake-token')
		},
		createClient(): unknown {
			return {
				streamWrite() {
					let aborted = false
					let sent: StreamWriteMessage_FromClient[] = []
					let sentWaiters: Array<() => void> = []
					let stream = Object.assign(
						new Duplex({
							objectMode: true,
							read() {},
							write(message: StreamWriteMessage_FromClient, _encoding, callback) {
								sent.push(message)
								for (let waiter of sentWaiters.splice(0)) {
									waiter()
								}
								callback()
							},
						}),
						{
							cancel() {
								aborted = true
								stream.destroy()
							},
						}
					)

					let waitForClient = async function waitForClient<T>(
						pick: (message: StreamWriteMessage_FromClient) => T | undefined
					): Promise<T> {
						for (;;) {
							for (let message of sent) {
								let result = pick(message)
								if (result !== undefined) {
									return result
								}
							}
							let next = deferred<void>()
							sentWaiters.push(next.resolve)
							// oxlint-disable-next-line no-await-in-loop
							await next.promise
						}
					}

					let handle: FakeWriteStream = {
						respond(message) {
							if (!stream.destroyed && !stream.readableEnded) {
								stream.push(message)
							}
						},
						disconnect() {
							stream.push(null)
						},
						fail(error) {
							stream.destroy(error as Error)
						},
						wasAborted() {
							return aborted
						},
						sent,
						waitForInit() {
							return waitForClient((message) =>
								message.clientMessage.case === 'initRequest'
									? message.clientMessage.value
									: undefined
							)
						},
						waitForWrite() {
							return waitForClient((message) =>
								message.clientMessage.case === 'writeRequest'
									? message.clientMessage.value
									: undefined
							)
						},
					}

					deliver(handle)
					return stream
				},
			}
		},
	} as unknown as Driver

	return { driver, waitForNextStream }
}

// ── server message builders ──────────────────────────────────────────────────────

export let initResponse = function initResponse(
	lastSeqNo: bigint,
	sessionId = 'session-1'
): StreamWriteMessage_FromServer {
	return {
		status: StatusIds_StatusCode.SUCCESS,
		issues: [],
		serverMessage: {
			case: 'initResponse',
			value: { lastSeqNo, sessionId, partitionId: 0n, supportedCodecs: undefined },
		},
	} as unknown as StreamWriteMessage_FromServer
}

export let writeResponse = function writeResponse(
	acks: Array<{ seqNo: bigint; status?: AckStatus; offset?: bigint }>
): StreamWriteMessage_FromServer {
	return {
		status: StatusIds_StatusCode.SUCCESS,
		issues: [],
		serverMessage: {
			case: 'writeResponse',
			value: {
				partitionId: 0n,
				acks: acks.map((ack) => ({
					seqNo: ack.seqNo,
					messageWriteStatus:
						(ack.status ?? 'written') === 'skipped'
							? { case: 'skipped', value: { reason: 0 } }
							: (ack.status ?? 'written') === 'writtenInTx'
								? { case: 'writtenInTx', value: {} }
								: { case: 'written', value: { offset: ack.offset ?? 0n } },
				})),
			},
		},
	} as unknown as StreamWriteMessage_FromServer
}

export let failureResponse = function failureResponse(
	status: StatusIds_StatusCode
): StreamWriteMessage_FromServer {
	return {
		status,
		issues: [],
		serverMessage: { case: undefined, value: undefined },
	} as unknown as StreamWriteMessage_FromServer
}

// ── async helpers ──────────────────────────────────────────────────────────────

export let settle = async function settle(ticks = 100): Promise<void> {
	for (let i = 0; i < ticks; i++) {
		// oxlint-disable-next-line no-await-in-loop
		await Promise.resolve()
	}
	await setImmediate()
}

export let tick = function tick(): Promise<void> {
	let d = deferred<void>()
	setTimeout(d.resolve, 0)
	return d.promise
}
