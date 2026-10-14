# Concurrent transactional KV RMW (Query API only)

This separate scenario leaves the ordinary `kv.*` workload intact. Build with
`npm --prefix tests/slo run build`, then use the existing supervisor:

```sh
node tests/slo/dist/index.js \
  --setup=kv-rmw.setup --teardown=kv-rmw.teardown --worker=kv-rmw.write \
  --kv-rmw.write.rps=100 --kv-rmw.write.concurrency=4 --kv-rmw.write.timeout=5000
```

Use the existing `YDB_CONNECTION_STRING`, `WORKLOAD_DURATION`, and OTLP settings.
The supervisor creates one process-unique namespace and passes it to setup,
worker, and teardown. `SLO_KV_NAMESPACE` may also be supplied explicitly; use the
same unique value throughout the lifecycle. Only `js_rmw_<namespace>_counters`
and `js_rmw_<namespace>_ledger` are created or dropped. Setup rejects table-name
collisions instead of erasing another run. A failed setup exits nonzero and
cleans only tables it created; the supervisor runs RMW teardown only after
successful setup.

`kv-rmw.setup.counters` and `kv-rmw.write.counters` must agree (default 2).
Worker defaults are `rps=100`, `concurrency=16`, and `timeout=100` milliseconds.
The consuming workflow explicitly selects four concurrent writers and a 5000ms
operation budget at the same target RPS. The bare defaults remain available;
a 100ms budget can legitimately fail a contended multi-request transaction.
The worker uses the SDK's existing retry policy within the selected budget.
It admits bounded concurrent rounds and waits for all contenders before the
next round, so new winners do not continuously overtake peers in SDK backoff.
The target RPS limits admitted operations; contention can lower achieved RPS.
It creates each ID before `sql.begin()` and applies ledger lookup, counter
read, value/version increment, and ledger INSERT in one serializable read-write
transaction. Exact replay returns without another increment; conflicting replay
fails. No Table or Topic adapter is provided.

Duration, SIGINT, SIGTERM, or the first final operation error stops admission.
Admitted operations keep their own budgets and settle before an independent
snapshot read. The checker requires the exact admitted ID set, exact ledger
counter/delta/generation, and exact per-counter value/version/generation. This
detects sum-preserving corruption as well as missing or extra rows. A final SDK
error remains the process verdict even if the independent read/check fails.
The supervisor does not restart failed KV RMW workers; Topic restart behavior
is unchanged. Forced RMW termination is a failure, including during shutdown.

Existing metrics retain their names and `write`/`success`/`error` attributes.
`sdk_retry_attempts_total` observes the SDK's outer transaction retry events,
including acquisition/Begin failures before the callback. Nested retry runs
are excluded; unique commits are not an attempt counter. The ordinary consuming
matrix includes separate Node and Bun RMW entries for both existing topologies.
Hosted runs and ambiguous-commit proof require their own evidence; deterministic
callback-seam tests alone are not native retry proof.
