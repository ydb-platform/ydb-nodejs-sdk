# SLO workload

SLO is the type of test where app based on ydb-sdk is tested against falling YDB claster nodes, tablets, network (that is possible situations for distributed DBs with hundreds of nodes)

It has 3 commands:

- `create` - creates table in database
- `cleanup` - drops table in database
- `run` - runs workload (read and write to table with setted RPS)

### Run examples with all arguments:

_Don't forget to set auth env variables_
create:
`node dist/src/index.js create `

cleanup:
`node dist/src/index.js cleanup`

run:
`node dist/src/index.js run grpcs://ydb.cool.example.com:2135 /some/folder --time 20 --shutdown-time 20 --read-rps 1000 --write-rps 100`

## Arguments for commands:

### create
`slo-nodejs-workload create <endpoint> <db> [options]`

```
Arguments:
  endpoint                        YDB endpoint to connect to
  db                              YDB database to connect to

Options:
  -t --table-name <tableName>                 table name to create
  -p --partitions-count <partitionsCount>     amount of partitions in table creation
  -c --initial-data-count <initialDataCount>  amount of initially created rows
```

### cleanup
`slo-nodejs-workload cleanup <endpoint> <db> [options]`

```
Arguments:
  endpoint                        YDB endpoint to connect to
  db                              YDB database to connect to

Options:
  -t --table-name <tableName>  table name to create
```

### run
`slo-nodejs-workload run <endpoint> <db> [options]`

```
Arguments:
  endpoint                        YDB endpoint to connect to
  db                              YDB database to connect to

Options:
  -t --table-name <tableName>     table name to read from
  --prom-pgw <promPgw>            prometheus push gateway
  --read-rps <readRps>            read RPS
  --read-timeout <readTimeout>    read timeout milliseconds
  --write-rps <writeRps>          write RPS
  --write-timeout <writeTimeout>  write timeout milliseconds
  --time <time>                   run time in seconds
  --shutdown-time <shutdownTime>  graceful shutdown time in seconds
  --report-period <reportPeriod>  prometheus push period in milliseconds
```


## What's inside
When running `run` command, the program creates three jobs: `readJob`, `writeJob`, `metricsJob`.
At first MaxID is configured to limit IDs in tasks.

- `readJob` reads rows from the table one by one with random identifiers in the range from `0` to `maxId` (perhaps later this will be changed to use the added rows as well)
- `writeJob` generates and inserts rows with identifiers exceeding the `maxId` (the batch size will be used later in the `run` command, now inserts rows only one at a time)
- `metricsJob` periodically sends metrics to Prometheus

Table have these fields: 
- `objectIdKey` (`UINT32`)
- `objectId` (`UINT32`)
- `timestamp` (`UINT64`)
- `payload` (`UTF8`)

## Collected metrics
- `oks` - amount of OK requests
- `not_oks` - amount of not OK requests
- `inflight` - amount of requests in flight
- `latency` - histogram of latencies in ms
- `realRPS` - Real sended requests per seconds

> You must debug resetting metrics to keep them `0` in prometheus and grafana before beginning and after ending of jobs

In `node.js` it looks like that:
```js
function resetStats() {
    this.registry.resetMetrics()
    // workaround due to not working resetting metrics via registry.resetMetrics()
    this.realRPS.remove('jobName')
    this.latencies.remove('jobName', 'status')
    this.inflight.set({ jobName: 'write' }, 0)
    this.inflight.set({ jobName: 'read' }, 0)
    this.oks.set({ jobName: 'write' }, 0)
    this.oks.set({ jobName: 'read' }, 0)
    this.notOks.set({ jobName: 'write' }, 0)
    this.notOks.set({ jobName: 'read' }, 0)
    this.pushStats()
}
```

## Look at metrics in grafana
You can get dashboard used in that test [here](https://github.com/ydb-platform/slo-tests/blob/main/k8s/helms/grafana.yaml#L69) - you will need to import json into grafana.

## Possible caveats
- RPS - use some rate limiter library or test it, like [here - RateLimiter.spec.ts](tests/unit/RateLimiter.spec.ts)
- Prometheus+pushgateway - example `docker-compose.yml` can be found [here](https://github.com/sa06/prometheus-pushgateway/blob/master/docker-compose.yml)
- Authentication - test uses anonymous auth mechanism in SLO, while in testing you can use whatever you want