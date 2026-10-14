import { Driver } from '@ydbjs/core'
import { query } from '@ydbjs/query'

import { rmwTables, teardownRmw } from '../../lib/kv-rmw.ts'
import { installSafetyHandlers } from '../../lib/safety.ts'

installSafetyHandlers()
process.exitCode = 1
let tables = rmwTables(process.env['SLO_KV_NAMESPACE'])
let driver = new Driver(process.env['YDB_CONNECTION_STRING']!)
try {
	await driver.ready()
	await using sql = query(driver)
	await teardownRmw(sql, tables)
	console.log('[kv-rmw.teardown] removed %s and %s', tables.counters, tables.ledger)
} finally {
	driver.close()
}
process.exit(0)
