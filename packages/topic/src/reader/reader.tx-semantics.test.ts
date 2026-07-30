import { TopicServiceDefinition } from '@ydbjs/api/topic'
import { expect, test } from 'vitest'

import type { TopicMessage } from '../message.ts'
import { TopicReader } from './index.ts'
import {
	initResponse,
	makeFakeTopicDriver,
	makeFakeTx,
	readResponse,
	settle,
	startPartitionSession,
} from './reader.fixtures.ts'

// Transactional-reader offset semantics against the fake streamRead driver: which
// offsets a tx commit binds (delivered vs merely buffered), where the commit range
// is anchored relative to the server committed offset, how the resulting
// UpdateOffsetsInTransaction call is routed, and what happens to the tracked
// offsets when the reader is closed before the transaction commits.

let bytes = function bytes(text: string): Uint8Array {
	return new TextEncoder().encode(text)
}

// Drive the shared read() iterator until `count` messages accumulate (idle ticks
// yield empty batches and are skipped). `signal` bounds a hang if they never arrive.
let collect = async function collect(
	reader: TopicReader,
	count: number,
	signal: AbortSignal
): Promise<TopicMessage[]> {
	let out: TopicMessage[] = []
	for await (let batch of reader.read({ batchWindowMs: 5, signal })) {
		out.push(...batch)
		if (out.length >= count) {
			break
		}
	}
	return out
}

// init handshake + read-credit grant, the precondition for every test below.
let primeStream = async function primeStream(
	waitForNextStream: ReturnType<typeof makeFakeTopicDriver>['waitForNextStream']
) {
	let stream = await waitForNextStream()
	await stream.waitForInit()
	stream.respond(initResponse('session-A'))
	await stream.waitForReadRequest()
	return stream
}

// At-least-once over processed messages: a transaction must bind only offsets the
// consumer actually received from read(). The reader records offsets the moment a
// ReadResponse is buffered, so the tx commit range extends over buffered-but-
// undelivered messages — once the transaction commits, those messages are skipped
// without ever being processed. Correct behavior: the wire range ends right after
// the last DELIVERED offset.
test.fails('binds only offsets delivered through read() to the transaction commit', async (tc) => {
	let { driver, waitForNextStream, txOffsetRequests } = makeFakeTopicDriver()
	let fake = makeFakeTx()
	using reader = new TopicReader(driver, { topic: '/t', consumer: 'c' }, { tx: fake.tx })

	let stream = await primeStream(waitForNextStream)
	stream.respond(
		startPartitionSession({ partitionSessionId: 1n, partitionId: 10n, committedOffset: 0n })
	)
	await stream.waitForStartResponse()
	stream.respond(
		readResponse({
			partitionSessionId: 1n,
			messages: [
				{ offset: 0n, seqNo: 1n, data: bytes('a') },
				{ offset: 1n, seqNo: 2n, data: bytes('b') },
			],
		})
	)
	await collect(reader, 2, tc.signal)

	// Three more messages arrive and sit in the buffer; read() never yields them.
	stream.respond(
		readResponse({
			partitionSessionId: 1n,
			messages: [
				{ offset: 2n, seqNo: 3n, data: bytes('c') },
				{ offset: 3n, seqNo: 4n, data: bytes('d') },
				{ offset: 4n, seqNo: 5n, data: bytes('e') },
			],
		})
	)
	await settle()

	await fake.commit()
	expect(txOffsetRequests).toHaveLength(1)
	expect(txOffsetRequests[0]!.topics[0]!.partitions[0]!.partitionOffsets).toEqual([
		expect.objectContaining({ start: 0n, end: 2n }),
	])
})

// The non-tx commit path anchors its first range at the server committed offset so a
// head gap (retention-expired offsets, a readOffset override) is covered and the
// server can advance the watermark. The tx path starts at the first delivered offset
// instead, committing a range that begins above the consumer high-water mark: the
// server either rejects the tx commit or never advances past the gap. Correct
// behavior: the wire range starts at the committed offset reported by
// start_partition_session_request.
test.fails('anchors the tx commit range at the server committed offset across a head gap', async (tc) => {
	let { driver, waitForNextStream, txOffsetRequests } = makeFakeTopicDriver()
	let fake = makeFakeTx()
	using reader = new TopicReader(driver, { topic: '/t', consumer: 'c' }, { tx: fake.tx })

	let stream = await primeStream(waitForNextStream)
	stream.respond(
		startPartitionSession({ partitionSessionId: 1n, partitionId: 10n, committedOffset: 3n })
	)
	await stream.waitForStartResponse()
	// First delivery starts above the committed offset 3 — offsets 3..4 are gone
	// (e.g. expired by retention).
	stream.respond(
		readResponse({
			partitionSessionId: 1n,
			messages: [
				{ offset: 5n, seqNo: 1n, data: bytes('a') },
				{ offset: 6n, seqNo: 2n, data: bytes('b') },
			],
		})
	)
	await collect(reader, 2, tc.signal)

	await fake.commit()
	expect(txOffsetRequests).toHaveLength(1)
	expect(txOffsetRequests[0]!.topics[0]!.partitions[0]!.partitionOffsets).toEqual([
		expect.objectContaining({ start: 3n, end: 7n }),
	])
})

// UpdateOffsetsInTransaction references the transaction's session, and session-bound
// RPCs are pinned to the node hosting that session (the query package passes
// session.nodeId to createClient for every session call). The topic reader creates
// the client with no node preference, so the request goes to an arbitrary
// load-balanced node. Correct behavior: pass the transaction's nodeId to
// createClient for the commit call.
test.fails('routes UpdateOffsetsInTransaction to the transaction session node', async (tc) => {
	let { driver, waitForNextStream, txOffsetRequests } = makeFakeTopicDriver()

	// The shared fixture's createClient ignores its arguments — wrap it to observe the
	// node preference each call carries.
	let createClientArgs: unknown[][] = []
	let innerCreateClient = driver.createClient.bind(driver) as (...args: unknown[]) => unknown
	;(driver as unknown as { createClient: (...args: unknown[]) => unknown }).createClient = (
		...args: unknown[]
	) => {
		createClientArgs.push(args)
		return innerCreateClient(...args)
	}

	let fake = makeFakeTx()
	// The query package's runtime tx object carries the session's nodeId even though
	// the topic-local TX type does not declare it.
	Object.assign(fake.tx, { nodeId: 42n })
	using reader = new TopicReader(driver, { topic: '/t', consumer: 'c' }, { tx: fake.tx })

	let stream = await primeStream(waitForNextStream)
	stream.respond(
		startPartitionSession({ partitionSessionId: 1n, partitionId: 10n, committedOffset: 0n })
	)
	await stream.waitForStartResponse()
	stream.respond(
		readResponse({
			partitionSessionId: 1n,
			messages: [{ offset: 0n, seqNo: 1n, data: bytes('a') }],
		})
	)
	await collect(reader, 1, tc.signal)

	let callsBefore = createClientArgs.length
	await fake.commit()
	expect(txOffsetRequests).toHaveLength(1)

	let commitCalls = createClientArgs.slice(callsBefore)
	expect(commitCalls.length).toBeGreaterThanOrEqual(1)
	expect(commitCalls[0]![0]).toBe(TopicServiceDefinition)
	expect(commitCalls[0]![1]).toBe(42n)
})

// Offsets consumed inside a transaction must never be dropped silently. close()
// before the tx commit clears the tracked offsets, and the later commit hook then
// succeeds while committing nothing — every message the transaction consumed is
// redelivered to the next consumer after the tx commits. Correct behavior: either
// the tracked offsets still reach UpdateOffsetsInTransaction, or close() / the
// commit hook raises instead of completing cleanly.
test.fails('preserves tracked read offsets when the reader closes before the tx commit', async (tc) => {
	let { driver, waitForNextStream, txOffsetRequests } = makeFakeTopicDriver()
	let fake = makeFakeTx()
	using reader = new TopicReader(driver, { topic: '/t', consumer: 'c' }, { tx: fake.tx })

	let stream = await primeStream(waitForNextStream)
	stream.respond(
		startPartitionSession({ partitionSessionId: 1n, partitionId: 10n, committedOffset: 0n })
	)
	await stream.waitForStartResponse()
	stream.respond(
		readResponse({
			partitionSessionId: 1n,
			messages: [{ offset: 0n, seqNo: 1n, data: bytes('a') }],
		})
	)
	await collect(reader, 1, tc.signal)

	let closeError: unknown
	try {
		await reader.close()
	} catch (error) {
		closeError = error
	}
	let commitError: unknown
	try {
		await fake.commit()
	} catch (error) {
		commitError = error
	}

	expect(
		closeError !== undefined || commitError !== undefined || txOffsetRequests.length === 1
	).toBe(true)
})
