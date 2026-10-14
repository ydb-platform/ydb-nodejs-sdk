import { randomUUID } from 'node:crypto'

import { type RmwAdapter, type RmwOperation, type RmwSnapshot, checkRmw } from './kv-rmw.ts'
import { runPaced } from './worker-api.ts'

export function rmwParameters(params: Record<string, string>) {
	let rps = Number(params['rps'] ?? '100')
	let concurrency = Number(params['concurrency'] ?? '16')
	let counters = Number(params['counters'] ?? '2')
	let timeout = Number(params['timeout'] ?? '100')
	if (
		!Number.isFinite(rps) ||
		rps < 0 ||
		![concurrency, counters, timeout].every((n) => Number.isSafeInteger(n) && n > 0)
	) {
		throw new Error(
			'KV RMW requires nonnegative rps and positive integer concurrency, counters and timeout'
		)
	}
	return { rps, concurrency, counters, timeout }
}

export async function runRmw(options: {
	adapter: RmwAdapter
	generation: string
	counterCount: number
	rps: number
	concurrency: number
	signal: AbortSignal
	onFailure?: (error: unknown) => void
	onDiagnosticsError?: (error: unknown) => void
}): Promise<{ expected: Map<string, RmwOperation>; snapshot: RmwSnapshot }> {
	let admission = new AbortController()
	let stop = () => admission.abort()
	if (options.signal.aborted) stop()
	else options.signal.addEventListener('abort', stop, { once: true })
	let expected = new Map<string, RmwOperation>()
	let failed = false
	let failure: unknown
	try {
		await runPaced(
			options.rps / options.concurrency,
			async () => {
				// Wait for every contender before admitting a new round. Replacing each
				// winner immediately can starve peers sleeping in the SDK retry backoff.
				await Promise.all(
					Array.from({ length: options.concurrency }, async () => {
						if (admission.signal.aborted) return
						let operation: RmwOperation = {
							op_id: randomUUID(),
							generation: options.generation,
							counter_id: BigInt(expected.size % options.counterCount),
							delta: 1n,
						}
						expected.set(operation.op_id, operation)
						try {
							// Admission cancellation is deliberately not the transaction signal:
							// settle admitted operations on their existing operation budgets.
							await options.adapter.apply(operation)
						} catch (error) {
							if (!failed) {
								failed = true
								failure = error
								admission.abort()
								options.onFailure?.(error)
							}
						}
					})
				)
			},
			admission.signal,
			1
		)
		let snapshot: RmwSnapshot
		try {
			snapshot = await options.adapter.read()
			checkRmw(expected, snapshot, options.generation, options.counterCount)
		} catch (error) {
			if (!failed) throw error
			options.onDiagnosticsError?.(error)
			throw failure
		}
		if (failed) throw failure
		return { expected, snapshot }
	} finally {
		options.signal.removeEventListener('abort', stop)
	}
}
