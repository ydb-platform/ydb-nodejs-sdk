import { workerData } from 'node:worker_threads'

import { Driver } from '@ydbjs/core'
import { query } from '@ydbjs/query'

import { rmwTables, setupRmw } from '../../lib/kv-rmw.ts'
import { rmwParameters } from '../../lib/kv-rmw-run.ts'
import { installSafetyHandlers } from '../../lib/safety.ts'
import type { WorkerData } from '../../lib/worker-api.ts'

installSafetyHandlers()
process.exitCode = 1
let { params } = workerData as WorkerData
let { counters } = rmwParameters(params)
let tables = rmwTables(process.env['SLO_KV_NAMESPACE'])
let driver = new Driver(process.env['YDB_CONNECTION_STRING']!)
try {
	await driver.ready()
	await using sql = query(driver)
	await setupRmw(sql, tables, counters)
	console.log(
		'[kv-rmw.setup] created %s and %s (%d counters)',
		tables.counters,
		tables.ledger,
		counters
	)
} finally {
	driver.close()
}
process.exit(0)
