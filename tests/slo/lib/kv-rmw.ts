import { AsyncLocalStorage } from 'node:async_hooks'
import { tracingChannel } from 'node:diagnostics_channel'

import type { QueryClient } from '@ydbjs/query'
import { Uint64 } from '@ydbjs/value/primitive'

export type RmwOperation = {
	op_id: string
	generation: string
	counter_id: bigint
	delta: bigint
}
export type RmwCounter = {
	counter_id: bigint
	generation: string
	value: bigint
	version: bigint
}
export type RmwSnapshot = { counters: RmwCounter[]; ledger: RmwOperation[] }
export type RmwTables = { counters: string; ledger: string; generation: string }
export type RmwAdapter = {
	apply: (operation: RmwOperation, onAttempt?: () => void) => Promise<void>
	read: () => Promise<RmwSnapshot>
}

type AttemptScope = { active: boolean; root?: unknown; notify?: () => void }
// Correlate the SDK's outer retry run, including acquisition/Begin before the body.
let attemptScopes = new AsyncLocalStorage<AttemptScope>()
let retryContexts = new AsyncLocalStorage<unknown>()
let retryRuns = tracingChannel('tracing:ydb:retry.run')
retryRuns.start.bindStore(retryContexts, (context) => context)
retryRuns.start.subscribe((context) => {
	let scope = attemptScopes.getStore()
	if (scope?.active && scope.root === undefined) scope.root = context
})
tracingChannel('tracing:ydb:retry.attempt').start.subscribe(() => {
	let scope = attemptScopes.getStore()
	if (scope?.active && scope.root !== undefined && scope.root === retryContexts.getStore()) {
		scope.notify?.()
	}
})

export function rmwTables(namespace: string | undefined): RmwTables {
	if (!namespace || !/^[a-zA-Z0-9_]+$/.test(namespace)) {
		throw new Error('KV RMW requires an alphanumeric SLO_KV_NAMESPACE')
	}
	return {
		counters: `js_rmw_${namespace}_counters`,
		ledger: `js_rmw_${namespace}_ledger`,
		generation: namespace,
	}
}

export async function setupRmw(sql: QueryClient, tables: RmwTables, counterCount: number) {
	let counters = sql.identifier(tables.counters)
	let ledger = sql.identifier(tables.ledger)
	let owned: (typeof counters)[] = []
	try {
		await sql`CREATE TABLE ${counters} (
		counter_id Uint64 NOT NULL, generation Text NOT NULL,
		value Uint64 NOT NULL, version Uint64 NOT NULL, PRIMARY KEY (counter_id)
	);`
		owned.push(counters)
		await sql`CREATE TABLE ${ledger} (
		op_id Text NOT NULL, generation Text NOT NULL,
		counter_id Uint64 NOT NULL, delta Uint64 NOT NULL, PRIMARY KEY (op_id)
	);`
		owned.push(ledger)
		let seed = Promise.resolve()
		for (let id = 0; id < counterCount; id++) {
			seed = seed.then(async () => {
				await sql`INSERT INTO ${counters} (counter_id, generation, value, version)
			VALUES (${new Uint64(BigInt(id))}, ${tables.generation}, ${new Uint64(0n)}, ${new Uint64(0n)});`.isolation(
					'serializableReadWrite'
				)
			})
		}
		await seed
	} catch (error) {
		let cleanup = Promise.resolve()
		for (let table of owned.reverse()) {
			cleanup = cleanup.then(async () => {
				try {
					await sql`DROP TABLE IF EXISTS ${table};`
				} catch (cleanupError) {
					console.error('[kv-rmw.setup] owned table cleanup failed:', cleanupError)
				}
			})
		}
		await cleanup
		throw error
	}
}

export async function teardownRmw(sql: QueryClient, tables: RmwTables) {
	await sql`DROP TABLE IF EXISTS ${sql.identifier(tables.ledger)};`
	await sql`DROP TABLE IF EXISTS ${sql.identifier(tables.counters)};`
}

export function queryRmwAdapter(sql: QueryClient, tables: RmwTables, timeout: number): RmwAdapter {
	let counters = sql.identifier(tables.counters)
	let ledger = sql.identifier(tables.ledger)
	return {
		async apply(operation, onAttempt) {
			// The caller constructs the logical operation before entering the SDK retry loop.
			let scope: AttemptScope = { active: true, notify: onAttempt }
			try {
				await attemptScopes.run(scope, () =>
					sql.begin(
						{
							isolation: 'serializableReadWrite',
							idempotent: true,
							signal: AbortSignal.timeout(timeout),
						},
						async (tx) => {
							let [existing] = await tx<
								[RmwOperation]
							>`SELECT op_id, generation, counter_id, delta
						FROM ${ledger} WHERE op_id = ${operation.op_id};`
							if (existing.length !== 0) {
								if (
									existing.length !== 1 ||
									!sameOperation(existing[0]!, operation)
								) {
									throw new Error(`KV RMW replay mismatch: ${operation.op_id}`)
								}
								return
							}
							let [rows] = await tx<
								[RmwCounter]
							>`SELECT counter_id, generation, value, version
						FROM ${counters} WHERE counter_id = ${new Uint64(operation.counter_id)};`
							let row = rows[0]
							if (
								rows.length !== 1 ||
								row?.generation !== operation.generation ||
								row.counter_id !== operation.counter_id
							) {
								throw new Error(
									`KV RMW missing or wrong-generation counter: ${operation.counter_id}`
								)
							}
							await tx`UPDATE ${counters}
						SET value = ${new Uint64(row.value + operation.delta)}, version = ${new Uint64(row.version + 1n)}
						WHERE counter_id = ${new Uint64(operation.counter_id)};
						INSERT INTO ${ledger} (op_id, generation, counter_id, delta)
						VALUES (${operation.op_id}, ${operation.generation}, ${new Uint64(operation.counter_id)}, ${new Uint64(operation.delta)});`
						}
					)
				)
			} finally {
				scope.active = false
			}
		},
		async read() {
			// A fresh transaction after admission stops and every admitted operation settles.
			let [counterRows, ledgerRows] = await sql<[RmwCounter, RmwOperation]>`
				SELECT counter_id, generation, value, version FROM ${counters};
				SELECT op_id, generation, counter_id, delta FROM ${ledger};`
				.idempotent(true)
				.isolation('snapshotReadOnly')
				.timeout(timeout)
			return { counters: counterRows, ledger: ledgerRows }
		},
	}
}

function sameOperation(actual: RmwOperation, expected: RmwOperation): boolean {
	return (
		actual.op_id === expected.op_id &&
		actual.generation === expected.generation &&
		actual.counter_id === expected.counter_id &&
		actual.delta === expected.delta
	)
}

export function checkRmw(
	expected: ReadonlyMap<string, RmwOperation>,
	snapshot: RmwSnapshot,
	generation: string,
	counterCount: number
): void {
	let seen = new Set<string>()
	let totals = Array.from({ length: counterCount }, () => ({ value: 0n, version: 0n }))
	for (let operation of snapshot.ledger) {
		let wanted = expected.get(operation.op_id)
		if (!wanted || seen.has(operation.op_id) || !sameOperation(operation, wanted)) {
			throw new Error(
				`KV RMW unexpected, duplicate or incorrect ledger operation: ${operation.op_id}`
			)
		}
		seen.add(operation.op_id)
		let total = totals[Number(operation.counter_id)]
		if (!total) throw new Error(`KV RMW unexpected ledger counter: ${operation.counter_id}`)
		total.value += operation.delta
		total.version++
	}
	if (seen.size !== expected.size)
		throw new Error(
			`KV RMW missing ledger operations: expected ${expected.size}, got ${seen.size}`
		)
	let seenCounters = new Set<bigint>()
	for (let counter of snapshot.counters) {
		let total = totals[Number(counter.counter_id)]
		if (
			!total ||
			seenCounters.has(counter.counter_id) ||
			counter.generation !== generation ||
			counter.value !== total.value ||
			counter.version !== total.version
		) {
			throw new Error(`KV RMW counter invariant mismatch: ${counter.counter_id}`)
		}
		seenCounters.add(counter.counter_id)
	}
	if (seenCounters.size !== counterCount)
		throw new Error(
			`KV RMW missing counters: expected ${counterCount}, got ${seenCounters.size}`
		)
}
