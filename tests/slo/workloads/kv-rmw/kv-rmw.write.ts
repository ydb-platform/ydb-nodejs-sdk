import { performance } from 'node:perf_hooks'
import { parentPort, workerData } from 'node:worker_threads'

import { ValueType } from '@opentelemetry/api'
import { Driver } from '@ydbjs/core'
import { query } from '@ydbjs/query'
import * as hdr from 'hdr-histogram-js'

import { type RmwAdapter, queryRmwAdapter, rmwTables } from '../../lib/kv-rmw.ts'
import { rmwParameters, runRmw } from '../../lib/kv-rmw-run.ts'
import { installSafetyHandlers } from '../../lib/safety.ts'
import {
	type FinOpAttrs,
	type OpAttrs,
	meterProvider,
	registerLatencyGauges,
} from '../../lib/telemetry.ts'
import { type WorkerData, abortOnStop } from '../../lib/worker-api.ts'

installSafetyHandlers()
let { name, params } = workerData as WorkerData
let { rps, concurrency, counters, timeout } = rmwParameters(params)
let tables = rmwTables(process.env['SLO_KV_NAMESPACE'])
let admission = new AbortController()
using _ = abortOnStop(admission)
let driver = new Driver(process.env['YDB_CONNECTION_STRING']!)
let meter = meterProvider.getMeter('kv-rmw-write-meter')
let latency = hdr.build({ highestTrackableValue: 60_000_000, numberOfSignificantValueDigits: 3 })
let operations = meter.createCounter<FinOpAttrs>('sdk_operations_total', {
	valueType: ValueType.INT,
})
let attempts = meter.createCounter<OpAttrs>('sdk_retry_attempts_total', {
	valueType: ValueType.INT,
})
let pending = meter.createUpDownCounter<OpAttrs>('sdk_pending_operations', {
	valueType: ValueType.INT,
})
registerLatencyGauges(meter, latency, { operation_type: 'write', operation_status: 'success' })
meter
	.createObservableGauge('sdk_memory_usage', { unit: 'bytes', valueType: ValueType.INT })
	.addCallback((result) => {
		let usage = process.memoryUsage()
		for (let type of ['rss', 'external', 'heapUsed', 'heapTotal', 'arrayBuffers'] as const) {
			result.observe(usage[type], { worker: name, type })
		}
	})

let failed = false
function fail(error: unknown) {
	if (failed) return
	failed = true
	console.error('[kv-rmw.write] final failure:', error)
	parentPort?.postMessage({ type: 'failure' })
}
try {
	await driver.ready()
	await using sql = query(driver)
	let native = queryRmwAdapter(sql, tables, timeout)
	let sdkAttempts = 0
	let adapter: RmwAdapter = {
		read: native.read,
		async apply(operation) {
			let start = performance.now()
			let count = 0
			let status: 'success' | 'error' = 'error'
			pending.add(1, { operation_type: 'write' })
			try {
				await native.apply(operation, () => {
					count++
					sdkAttempts++
				})
				status = 'success'
				latency.recordValue(Math.round((performance.now() - start) * 1000))
			} finally {
				pending.add(-1, { operation_type: 'write' })
				operations.add(1, { operation_type: 'write', operation_status: status })
				attempts.add(count, { operation_type: 'write' })
			}
		},
	}
	console.log(
		'[kv-rmw.write] running rps=%d concurrency=%d counters=%d timeout=%dms',
		rps,
		concurrency,
		counters,
		timeout
	)
	let result = await runRmw({
		adapter,
		generation: tables.generation,
		counterCount: counters,
		rps,
		concurrency,
		signal: admission.signal,
		onFailure: fail,
		onDiagnosticsError: (error) =>
			console.error('[kv-rmw.write] invariant diagnostics failed:', error),
	})
	console.log(
		'[kv-rmw.write] verified %d exact logical IDs, %d counters; SDK attempts=%d',
		result.expected.size,
		result.snapshot.counters.length,
		sdkAttempts
	)
} catch (error) {
	fail(error)
} finally {
	let cleanup = Promise.resolve()
	for (let [label, close] of [
		['meter flush', () => meterProvider.forceFlush()],
		['meter shutdown', () => meterProvider.shutdown()],
		['driver close', () => driver.close()],
	] as const) {
		cleanup = cleanup.then(async () => {
			try {
				await close()
			} catch (error) {
				console.error('[kv-rmw.write] %s failed:', label, error)
			}
		})
	}
	await cleanup
}
process.exit(failed ? 1 : 0)
