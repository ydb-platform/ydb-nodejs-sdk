import { setImmediate } from 'node:timers/promises'
import { Duplex } from 'node:stream'
import type { requestCallback } from '@grpc/grpc-js'
import {
	Codec,
	type StreamReadMessage_CommitOffsetRequest,
	type StreamReadMessage_FromClient,
	type StreamReadMessage_FromServer,
	type StreamReadMessage_InitRequest,
	type StreamReadMessage_ReadRequest,
	type StreamReadMessage_StartPartitionSessionResponse,
	type UpdateOffsetsInTransactionRequest,
	type UpdateOffsetsInTransactionResponse,
	type UpdateTokenRequest,
} from '@ydbjs/api/topic'
import { StatusIds_StatusCode } from '@ydbjs/api/operation'
import type { Driver } from '@ydbjs/core'

import type { TX } from '../tx.js'

// A handle to one streamRead the reader opened. Lets the test drive the server
// side (respond / disconnect / fail) and inspect what the reader sent (init /
// read requests / commits / start-session acks).
export type FakeReadStream = {
	respond(message: StreamReadMessage_FromServer): void
	disconnect(): void
	fail(error: unknown): void
	// True once the reader aborted this stream's signal (i.e. tore the stream down).
	wasAborted(): boolean
	sent: StreamReadMessage_FromClient[]
	waitForInit(): Promise<StreamReadMessage_InitRequest>
	waitForReadRequest(): Promise<StreamReadMessage_ReadRequest>
	waitForCommit(): Promise<StreamReadMessage_CommitOffsetRequest>
	waitForStartResponse(): Promise<StreamReadMessage_StartPartitionSessionResponse>
	waitForUpdateToken(): Promise<UpdateTokenRequest>
}

export type FakeTopicDriver = {
	driver: Driver
	waitForNextStream(): Promise<FakeReadStream>
	// Number of streamRead streams opened so far (one per connect / reconnect).
	streamCount(): number
	// Every UpdateOffsetsInTransaction request the tx commit hook sent (acked with
	// SUCCESS) — the wire-level observation point for tx read offsets.
	txOffsetRequests: UpdateOffsetsInTransactionRequest[]
}

// A fake transaction that captures the lifecycle hooks the reader registers (it
// registers exactly one of each), so a test can fire commit / rollback / close and
// observe how the reader reacts. Mirrors the writer's fixture of the same name.
export let makeFakeTx = function makeFakeTx() {
	let onCommit: ((signal?: AbortSignal) => Promise<void> | void) | undefined
	let onRollback: ((error: unknown, signal?: AbortSignal) => Promise<void> | void) | undefined
	let onClose: ((committed: boolean, signal?: AbortSignal) => Promise<void> | void) | undefined
	let tx = {
		sessionId: 'tx-session',
		transactionId: 'tx-1',
		onCommit: (fn: (signal?: AbortSignal) => Promise<void> | void) => (onCommit = fn),
		onRollback: (fn: (error: unknown, signal?: AbortSignal) => Promise<void> | void) =>
			(onRollback = fn),
		onClose: (fn: (committed: boolean, signal?: AbortSignal) => Promise<void> | void) =>
			(onClose = fn),
	} as unknown as TX
	return {
		tx,
		commit: (signal?: AbortSignal): Promise<void> | void => onCommit?.(signal),
		rollback: (error: unknown): Promise<void> | void => onRollback?.(error),
		close: (committed: boolean): Promise<void> | void => onClose?.(committed),
	}
}

let deferred = function deferred<T>(): PromiseWithResolvers<T> {
	return Promise.withResolvers<T>()
}

export let makeFakeTopicDriver = function makeFakeTopicDriver(): FakeTopicDriver {
	let pendingHandles: FakeReadStream[] = []
	let pendingWaiters: Array<(handle: FakeReadStream) => void> = []
	let opened = 0
	let txOffsetRequests: UpdateOffsetsInTransactionRequest[] = []

	let waitForNextStream = function waitForNextStream(): Promise<FakeReadStream> {
		if (pendingHandles.length > 0) {
			return Promise.resolve(pendingHandles.shift()!)
		}
		let d = deferred<FakeReadStream>()
		pendingWaiters.push(d.resolve)
		return d.promise
	}

	let deliver = function deliver(handle: FakeReadStream): void {
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
				updateOffsetsInTransaction(
					request: UpdateOffsetsInTransactionRequest,
					callback: requestCallback<UpdateOffsetsInTransactionResponse>
				) {
					txOffsetRequests.push(request)
					callback(null, {
						operation: {
							ready: true,
							status: StatusIds_StatusCode.SUCCESS,
							issues: [],
						},
					} as unknown as UpdateOffsetsInTransactionResponse)
					return { cancel() {} }
				},
				streamRead() {
					opened++
					let aborted = false
					let sent: StreamReadMessage_FromClient[] = []
					let sentWaiters: Array<() => void> = []
					let stream = Object.assign(
						new Duplex({
							objectMode: true,
							read() {},
							write(message: StreamReadMessage_FromClient, _encoding, callback) {
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
						pick: (message: StreamReadMessage_FromClient) => T | undefined
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

					let handle: FakeReadStream = {
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
						waitForReadRequest() {
							return waitForClient((message) =>
								message.clientMessage.case === 'readRequest'
									? message.clientMessage.value
									: undefined
							)
						},
						waitForCommit() {
							return waitForClient((message) =>
								message.clientMessage.case === 'commitOffsetRequest'
									? message.clientMessage.value
									: undefined
							)
						},
						waitForStartResponse() {
							return waitForClient((message) =>
								message.clientMessage.case === 'startPartitionSessionResponse'
									? message.clientMessage.value
									: undefined
							)
						},
						waitForUpdateToken() {
							return waitForClient((message) =>
								message.clientMessage.case === 'updateTokenRequest'
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

	return { driver, waitForNextStream, streamCount: () => opened, txOffsetRequests }
}

// ── server message builders ──────────────────────────────────────────────────────

export let initResponse = function initResponse(
	sessionId = 'session-1'
): StreamReadMessage_FromServer {
	return {
		status: StatusIds_StatusCode.SUCCESS,
		issues: [],
		serverMessage: { case: 'initResponse', value: { sessionId } },
	} as unknown as StreamReadMessage_FromServer
}

export let startPartitionSession = function startPartitionSession(params: {
	partitionSessionId: bigint
	partitionId: bigint
	path?: string
	committedOffset?: bigint
	start?: bigint
	end?: bigint
}): StreamReadMessage_FromServer {
	return {
		status: StatusIds_StatusCode.SUCCESS,
		issues: [],
		serverMessage: {
			case: 'startPartitionSessionRequest',
			value: {
				partitionSession: {
					partitionSessionId: params.partitionSessionId,
					partitionId: params.partitionId,
					path: params.path ?? '/t',
				},
				committedOffset: params.committedOffset ?? 0n,
				partitionOffsets: { start: params.start ?? 0n, end: params.end ?? 0n },
			},
		},
	} as unknown as StreamReadMessage_FromServer
}

// A one-batch ReadResponse for a single partition session. `data` defaults to the
// raw (uncompressed) payload; codec defaults to RAW so the reader decodes it as
// identity — pass a compressed `data` together with its `codec` otherwise.
export let readResponse = function readResponse(params: {
	partitionSessionId: bigint
	messages: Array<{ offset: bigint; seqNo: bigint; data: Uint8Array }>
	bytesSize?: bigint
	producerId?: string
	codec?: Codec
}): StreamReadMessage_FromServer {
	let bytesSize =
		params.bytesSize ?? params.messages.reduce((acc, m) => acc + BigInt(m.data.length), 0n)
	return {
		status: StatusIds_StatusCode.SUCCESS,
		issues: [],
		serverMessage: {
			case: 'readResponse',
			value: {
				bytesSize,
				partitionData: [
					{
						partitionSessionId: params.partitionSessionId,
						batches: [
							{
								producerId: params.producerId ?? 'producer-1',
								codec: params.codec ?? Codec.RAW,
								messageData: params.messages.map((m) => ({
									offset: m.offset,
									seqNo: m.seqNo,
									data: m.data,
									uncompressedSize: BigInt(m.data.length),
									metadataItems: [],
								})),
							},
						],
					},
				],
			},
		},
	} as unknown as StreamReadMessage_FromServer
}

export let commitOffsetResponse = function commitOffsetResponse(
	committed: Array<{ partitionSessionId: bigint; committedOffset: bigint }>
): StreamReadMessage_FromServer {
	return {
		status: StatusIds_StatusCode.SUCCESS,
		issues: [],
		serverMessage: {
			case: 'commitOffsetResponse',
			value: { partitionsCommittedOffsets: committed },
		},
	} as unknown as StreamReadMessage_FromServer
}

export let stopPartitionSession = function stopPartitionSession(params: {
	partitionSessionId: bigint
	graceful?: boolean
	committedOffset?: bigint
}): StreamReadMessage_FromServer {
	return {
		status: StatusIds_StatusCode.SUCCESS,
		issues: [],
		serverMessage: {
			case: 'stopPartitionSessionRequest',
			value: {
				partitionSessionId: params.partitionSessionId,
				graceful: params.graceful ?? false,
				committedOffset: params.committedOffset ?? 0n,
			},
		},
	} as unknown as StreamReadMessage_FromServer
}

export let updateTokenResponse = function updateTokenResponse(): StreamReadMessage_FromServer {
	return {
		status: StatusIds_StatusCode.SUCCESS,
		issues: [],
		serverMessage: { case: 'updateTokenResponse', value: {} },
	} as unknown as StreamReadMessage_FromServer
}

export let partitionStatusResponse = function partitionStatusResponse(
	partitionSessionId: bigint,
	committedOffset: bigint
): StreamReadMessage_FromServer {
	return {
		status: StatusIds_StatusCode.SUCCESS,
		issues: [],
		serverMessage: {
			case: 'partitionSessionStatusResponse',
			value: { partitionSessionId, committedOffset, readOffset: committedOffset },
		},
	} as unknown as StreamReadMessage_FromServer
}

export let failureResponse = function failureResponse(
	status: StatusIds_StatusCode
): StreamReadMessage_FromServer {
	return {
		status,
		issues: [],
		serverMessage: { case: undefined, value: undefined },
	} as unknown as StreamReadMessage_FromServer
}

// ── async helpers ──────────────────────────────────────────────────────────────

export let settle = async function settle(ticks = 100): Promise<void> {
	for (let i = 0; i < ticks; i++) {
		// oxlint-disable-next-line no-await-in-loop
		await Promise.resolve()
	}
	await setImmediate()
}
