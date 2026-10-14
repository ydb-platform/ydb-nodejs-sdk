import { tracingChannel } from 'node:diagnostics_channel'

import type { QueryClient, TX } from '@ydbjs/query'
import { Uint64 } from '@ydbjs/value/primitive'
import { expect, test } from 'vitest'

import {
	type RmwOperation,
	type RmwSnapshot,
	checkRmw,
	queryRmwAdapter,
	rmwTables,
	setupRmw,
} from './kv-rmw.ts'

let generation = 'test_generation'
function operation(id: string, counter = 0n): RmwOperation {
	return { op_id: id, generation, counter_id: counter, delta: 1n }
}
function image(): RmwSnapshot {
	return {
		counters: [
			{ counter_id: 0n, generation, value: 1n, version: 1n },
			{ counter_id: 1n, generation, value: 1n, version: 1n },
		],
		ledger: [operation('first'), operation('second', 1n)],
	}
}
let expected = new Map(image().ledger.map((op) => [op.op_id, op]))
let retryRuns = tracingChannel('tracing:ydb:retry.run')
let retryAttempts = tracingChannel('tracing:ydb:retry.attempt')

for (let [failureAt, removed] of [
	[1, []],
	[2, ['counters']],
	[3, ['ledger', 'counters']],
] as const) {
	test(`cleans only owned tables after setup statement ${failureAt} fails`, async () => {
		let tables = rmwTables(generation)
		let failure = new Error('setup-failure')
		let statement = 0
		let drops: string[] = []
		let sql = Object.assign(
			(strings: TemplateStringsArray, ...values: unknown[]) => {
				statement++
				if (strings.join('?').startsWith('DROP TABLE')) drops.push(String(values[0]))
				let result = statement === failureAt ? Promise.reject(failure) : Promise.resolve([])
				return Object.assign(result, { isolation: () => result })
			},
			{ identifier: (name: string) => name }
		) as unknown as QueryClient
		await expect(setupRmw(sql, tables, 1)).rejects.toBe(failure)
		expect(drops).toEqual(removed.map((kind) => tables[kind]))
	})
}

// Callback replay is a deterministic transaction seam, not evidence of an SDK
// retry. Native QA separately loses a response after a real persisted commit.
function transactionSeam(replay: 'none' | 'rollback' | 'persisted' | 'before-callback') {
	let state: RmwSnapshot = {
		counters: [{ counter_id: 0n, generation, value: 0n, version: 0n }],
		ledger: [],
	}
	let attempts: string[] = []
	let writes = 0
	let sql = Object.assign(
		() => {
			let result = Promise.resolve([state.counters, state.ledger])
			return Object.assign(result, {
				idempotent: () => result,
				isolation: () => result,
				timeout: () => result,
			})
		},
		{
			identifier: (name: string) => name,
			async begin(
				options: { isolation: string; idempotent: boolean; signal: AbortSignal },
				callback: (tx: TX) => Promise<void>
			) {
				expect(options.isolation).toBe('serializableReadWrite')
				expect(options.idempotent).toBe(true)
				expect(options.signal.aborted).toBe(false)
				let execute = async () => {
					let staged = structuredClone(state)
					let tx = (strings: TemplateStringsArray, ...parameters: unknown[]) => {
						let text = strings.join('?')
						if (text.includes('SELECT op_id')) {
							let id = parameters[1] as string
							attempts.push(id)
							return Promise.resolve([staged.ledger.filter((op) => op.op_id === id)])
						}
						if (text.includes('SELECT counter_id'))
							return Promise.resolve([staged.counters])
						if (!text.includes('UPDATE') || !text.includes('INSERT INTO'))
							throw new Error('unexpected transaction query')
						writes++
						staged.counters[0]!.value = (parameters[1] as Uint64).value as bigint
						staged.counters[0]!.version = (parameters[2] as Uint64).value as bigint
						staged.ledger.push({
							op_id: parameters[5] as string,
							generation: parameters[6] as string,
							counter_id: (parameters[7] as Uint64).value as bigint,
							delta: (parameters[8] as Uint64).value as bigint,
						})
						return Promise.resolve([])
					}
					await callback(tx as unknown as TX)
					return staged
				}
				await retryRuns.tracePromise(
					async () => {
						if (replay === 'before-callback') {
							let failure = new Error('begin-failure')
							await retryAttempts
								.tracePromise(() => Promise.reject(failure), {
									attempt: 1,
									idempotent: true,
									backoffMs: 0,
								})
								.catch((error: unknown) => expect(error).toBe(failure))
							await retryRuns.tracePromise(
								() =>
									retryAttempts.tracePromise(() => Promise.resolve(), {
										attempt: 1,
										idempotent: true,
										backoffMs: 0,
									}),
								{ idempotent: true }
							)
						}
						let first = await retryAttempts.tracePromise(execute, {
							attempt: replay === 'before-callback' ? 2 : 1,
							idempotent: true,
							backoffMs: 0,
						})
						if (replay === 'persisted') state = first
						state =
							replay === 'none' || replay === 'before-callback'
								? first
								: await retryAttempts.tracePromise(execute, {
										attempt: 2,
										idempotent: true,
										backoffMs: 0,
									})
					},
					{ idempotent: true }
				)
			},
		}
	) as unknown as QueryClient
	return {
		adapter: queryRmwAdapter(sql, rmwTables(generation), 100),
		state: () => state,
		attempts,
		writes: () => writes,
	}
}

test('counts outer SDK attempts before the transaction body and ignores nested retry runs', async () => {
	let seam = transactionSeam('before-callback')
	let op = operation('begin-retry')
	let attempts = 0
	await seam.adapter.apply(op, () => attempts++)
	expect(attempts).toBe(2)
	expect(seam.attempts).toEqual([op.op_id])
	checkRmw(new Map([[op.op_id, op]]), seam.state(), generation, 1)
})

test('keeps one logical ID across callback retries and an exact replay', async () => {
	let seam = transactionSeam('rollback')
	let op = operation('stable')
	await seam.adapter.apply(op)
	expect(seam.attempts).toEqual(['stable', 'stable'])
	checkRmw(new Map([[op.op_id, op]]), seam.state(), generation, 1)
	await seam.adapter.apply(op)
	expect(seam.state().counters[0]).toMatchObject({ value: 1n, version: 1n })
	expect(seam.state().ledger).toHaveLength(1)
})

test('does not increment after a persisted transaction callback is replayed', async () => {
	let seam = transactionSeam('persisted')
	let op = operation('persisted')
	await seam.adapter.apply(op)
	expect(seam.attempts).toEqual(['persisted', 'persisted'])
	expect(seam.writes()).toBe(1)
	checkRmw(new Map([[op.op_id, op]]), seam.state(), generation, 1)
})

test('rejects a replay with the same ID but a different delta', async () => {
	let seam = transactionSeam('none')
	await seam.adapter.apply(operation('stable'))
	await expect(seam.adapter.apply({ ...operation('stable'), delta: 2n })).rejects.toThrow(
		'replay mismatch'
	)
})

test('accepts exact ledger IDs and exact per-counter value and version', () => {
	expect(() => checkRmw(expected, image(), generation, 2)).not.toThrow()
})

for (let [name, corrupt] of [
	[
		'lost update',
		(snapshot: RmwSnapshot) => {
			snapshot.counters[0]!.value = 0n
		},
	],
	[
		'sum-preserving corruption',
		(snapshot: RmwSnapshot) => {
			snapshot.counters[0]!.value = 0n
			snapshot.counters[1]!.value = 2n
		},
	],
	[
		'wrong counter version',
		(snapshot: RmwSnapshot) => {
			snapshot.counters[0]!.version = 0n
		},
	],
	[
		'wrong counter generation',
		(snapshot: RmwSnapshot) => {
			snapshot.counters[0]!.generation = 'foreign'
		},
	],
	[
		'missing ledger ID',
		(snapshot: RmwSnapshot) => {
			snapshot.ledger.pop()
		},
	],
	[
		'extra ledger ID',
		(snapshot: RmwSnapshot) => {
			snapshot.ledger.push(operation('extra'))
		},
	],
	[
		'duplicate ledger ID',
		(snapshot: RmwSnapshot) => {
			snapshot.ledger[1] = { ...snapshot.ledger[0]! }
		},
	],
	[
		'wrong ledger generation',
		(snapshot: RmwSnapshot) => {
			snapshot.ledger[0]!.generation = 'foreign'
		},
	],
	[
		'wrong ledger counter',
		(snapshot: RmwSnapshot) => {
			snapshot.ledger[0]!.counter_id = 1n
		},
	],
	[
		'wrong ledger delta',
		(snapshot: RmwSnapshot) => {
			snapshot.ledger[0]!.delta = 2n
		},
	],
	[
		'missing counter',
		(snapshot: RmwSnapshot) => {
			snapshot.counters.pop()
		},
	],
	[
		'extra counter',
		(snapshot: RmwSnapshot) => {
			snapshot.counters.push({ ...snapshot.counters[0]!, counter_id: 2n })
		},
	],
	[
		'duplicate counter',
		(snapshot: RmwSnapshot) => {
			snapshot.counters[1] = { ...snapshot.counters[0]! }
		},
	],
] as const) {
	test(`rejects ${name}`, () => {
		let snapshot = image()
		corrupt(snapshot)
		expect(() => checkRmw(expected, snapshot, generation, 2)).toThrow('KV RMW')
	})
}
