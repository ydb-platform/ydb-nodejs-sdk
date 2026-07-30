// Metric instrument names and tag keys that exist only on metrics.
// Tag keys shared with spans are declared in `spans.ts` / `common.ts` to
// keep both pipelines pointed at one string.

export let METRIC_DB_CLIENT_OPERATION_DURATION = 'db.client.operation.duration'

export let METRIC_YDB_DRIVER_CONNECTION_PESSIMIZATIONS = 'ydb.driver.connection.pessimizations'

export let METRIC_YDB_QUERY_SESSION_CREATE_DURATION = 'ydb.query.session.create.duration'
export let METRIC_YDB_QUERY_SESSION_ACQUIRE_DURATION = 'ydb.query.session.acquire.duration'
export let METRIC_YDB_QUERY_SESSION_ACQUIRE_PENDING = 'ydb.query.session.acquire.pending'
export let METRIC_YDB_QUERY_SESSION_ACQUIRE_FAILURES = 'ydb.query.session.acquire.failures'
export let METRIC_YDB_QUERY_SESSION_CLOSED = 'ydb.query.session.closed'
export let METRIC_YDB_QUERY_SESSION_COUNT = 'ydb.query.session.count'
export let METRIC_YDB_QUERY_SESSION_MAX = 'ydb.query.session.max'
export let METRIC_YDB_QUERY_SESSION_MIN = 'ydb.query.session.min'
export let METRIC_YDB_DRIVER_CONNECTION_COUNT = 'ydb.driver.connection.count'

// Aggregate routing-snapshot gauges, sourced from ydb:driver.connection.pool.stats
// (the pool's own view). Distinct from the per-connection, event-reconstructed
// `ydb.driver.connection.count` above.
export let METRIC_YDB_DRIVER_POOL_TOTAL = 'ydb.driver.pool.total'
export let METRIC_YDB_DRIVER_POOL_ROUTABLE = 'ydb.driver.pool.routable'
export let METRIC_YDB_DRIVER_POOL_PESSIMIZED = 'ydb.driver.pool.pessimized'
export let METRIC_YDB_DRIVER_POOL_NODES = 'ydb.driver.pool.nodes'
// Info-style gauge (always 1) carrying the driver's routing mode as tags.
// The mode must NOT ride the routable gauge: `pool.opened` fires once at
// construction, so a late subscriber would emit that gauge under a different
// attribute-key set for the driver's whole life — two distinct series for one
// logical measurement.
export let METRIC_YDB_DRIVER_POOL_CONFIG = 'ydb.driver.pool.config'

// Bridge (2DC) topology counters.
export let METRIC_YDB_DRIVER_PILE_FALLBACKS = 'ydb.driver.pile.fallbacks'
export let METRIC_YDB_DRIVER_PILE_CHANGES = 'ydb.driver.pile.changes'

export let METRIC_YDB_AUTH_TOKEN_FETCH_DURATION = 'ydb.auth.token.fetch.duration'
export let METRIC_YDB_AUTH_TOKEN_FETCH_FAILURES = 'ydb.auth.token.fetch.failures'
export let METRIC_YDB_AUTH_TOKEN_REFRESHES = 'ydb.auth.token.refreshes'
export let METRIC_YDB_AUTH_TOKEN_EXPIRATIONS = 'ydb.auth.token.expirations'

export let METRIC_YDB_RETRY_ATTEMPTS = 'ydb.retry.attempts'
export let METRIC_YDB_RETRY_DURATION = 'ydb.retry.duration'

export let ATTR_YDB_RETRY_OUTCOME = 'ydb.retry.outcome'

export let ATTR_YDB_CONNECTION_STATE = 'ydb.connection.state'
export let ATTR_YDB_SESSION_STATE = 'ydb.session.state'

// Routing tier of a routable endpoint (`ydb.driver.pool.routable`). Its meaning
// depends on the driver's routing mode, hence the config tags below.
export let ATTR_YDB_ROUTING_TIER = 'ydb.routing.tier'
// Routing config folded in from ydb:driver.connection.pool.opened — one fixed
// value per driver, so cardinality stays bounded.
export let ATTR_YDB_ROUTING_PREFER_PRIMARY_PILE = 'ydb.routing.prefer_primary_pile'
export let ATTR_YDB_ROUTING_LOCALITY_ENABLED = 'ydb.routing.locality_enabled'

// Pile identity for `ydb.driver.pool.nodes`. Only the NAME is a tag: a pile's
// status is mutable, and under cumulative temporality OTel never retires an
// attribute set that stops being observed, so tagging by status would fork the
// series on every failover and leave the pre-failover one frozen at its last
// value forever. Status changes are carried by `ydb.driver.pile.changes` and
// the discovery span event instead.
export let ATTR_YDB_PILE_NAME = 'ydb.pile.name'
// Direction of a `ydb.driver.pile.fallbacks` transition: true = entered the
// SYNCHRONIZED fallback tier, false = recovered to the primary pile.
export let ATTR_YDB_PILE_FALLBACK_ACTIVE = 'ydb.pile.fallback.active'
