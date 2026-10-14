import { expect, test } from 'vitest'

import type { RmwOperation } from './kv-rmw.ts'
import { rmwParameters, runRmw } from './kv-rmw-run.ts'

let generation = 'test_generation'

test('stops admission on planned shutdown but settles admitted operations before reading', async () => {
	let ctrl = new AbortController()
	let entered = Promise.withResolvers<void>()
	let settle = Promise.withResolvers<void>()
	let readStarted = false
	let admitted: RmwOperation[] = []
	let run = runRmw({
		generation,
		counterCount: 1,
		rps: 0,
		concurrency: 1,
		signal: ctrl.signal,
		adapter: {
			async apply(op) {
				admitted.push(op)
				entered.resolve()
				await settle.promise
			},
			async read() {
				readStarted = true
				return {
					counters: [{ counter_id: 0n, generation, value: 1n, version: 1n }],
					ledger: admitted,
				}
			},
		},
	})
	await entered.promise
	ctrl.abort()
	expect(readStarted).toBe(false)
	settle.resolve()
	await expect(run).resolves.toMatchObject({
		expected: new Map([[admitted[0]!.op_id, admitted[0]!]]),
	})
	expect(admitted).toHaveLength(1)
	expect(readStarted).toBe(true)
})

test('preserves the final original error when an independent read also fails after shutdown', async () => {
	let ctrl = new AbortController()
	let entered = Promise.withResolvers<void>()
	let settle = Promise.withResolvers<void>()
	let original = new DOMException('original SDK operation deadline', 'TimeoutError')
	let diagnostics = new Error('independent read unavailable')
	let observed: unknown
	let run = runRmw({
		generation,
		counterCount: 1,
		rps: 0,
		concurrency: 1,
		signal: ctrl.signal,
		onDiagnosticsError: (error) => {
			observed = error
		},
		adapter: {
			async apply() {
				entered.resolve()
				await settle.promise
				throw original
			},
			async read() {
				throw diagnostics
			},
		},
	})
	await entered.promise
	ctrl.abort()
	settle.resolve()
	await expect(run).rejects.toBe(original)
	expect(observed).toBe(diagnostics)
})

test('stops admission after failure and waits for every other admitted operation', async () => {
	let ctrl = new AbortController()
	let bothEntered = Promise.withResolvers<void>()
	let first = Promise.withResolvers<void>()
	let second = Promise.withResolvers<void>()
	let failureLatched = Promise.withResolvers<void>()
	let original = new Error('final SDK transaction error')
	let admitted: RmwOperation[] = []
	let secondSettled = false
	let run = runRmw({
		generation,
		counterCount: 1,
		rps: 0,
		concurrency: 2,
		signal: ctrl.signal,
		onFailure: () => failureLatched.resolve(),
		adapter: {
			async apply(op) {
				admitted.push(op)
				if (admitted.length === 1) await first.promise
				else {
					bothEntered.resolve()
					await second.promise
					secondSettled = true
				}
			},
			async read() {
				expect(secondSettled).toBe(true)
				return {
					counters: [{ counter_id: 0n, generation, value: 2n, version: 2n }],
					ledger: admitted,
				}
			},
		},
	})
	await bothEntered.promise
	first.reject(original)
	await failureLatched.promise
	second.resolve()
	await expect(run).rejects.toBe(original)
	expect(admitted).toHaveLength(2)
})

test('rejects invalid RMW admission parameters', () => {
	for (let params of [
		{ counters: '0' },
		{ concurrency: '-1' },
		{ timeout: 'NaN' },
		{ rps: '-1' },
	]) {
		expect(() => rmwParameters(params)).toThrow('KV RMW')
	}
})
