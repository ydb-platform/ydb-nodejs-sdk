import { writeFile } from 'fs/promises'
import http from 'http'
import { Gauge, Summary, Registry, Pushgateway } from 'prom-client'
import { Driver, ExecuteQuerySettings, OperationParams, Session } from 'ydb-sdk'
import { packages } from '../../package-lock.json'

const sdkVersion = packages['node_modules/ydb-sdk'].version

const percentiles = [0.5, 0.9, 0.95, 0.99, 0.999]

export default class Executor {
  private readonly driver: Driver
  private readonly registry = new Registry()
  private readonly oks: Gauge
  private readonly notOks: Gauge
  private readonly inflight: Gauge
  private readonly latencies: Summary
  private readonly gateway: Pushgateway
  private collectingMetrics: Boolean = true
  readonly realRPS: Gauge
  readonly tableName: string
  readonly stopTime: number
  readonly readExecuteQuerySettings: ExecuteQuerySettings
  readonly writeExecuteQuerySettings: ExecuteQuerySettings
  readonly readQuery: string
  readonly writeQuery: string

  constructor(
    driver: Driver,
    pushGateway: string,
    tableName: string,
    runTimeSecs: number,
    readTimeout: number,
    writeTimeout: number
  ) {
    this.driver = driver
    this.tableName = tableName
    this.stopTime = new Date().valueOf() + runTimeSecs * 1000

    this.readQuery = `DECLARE $id AS Uint64;
SELECT id, payload_str, payload_double, payload_timestamp, payload_hash
FROM \`${this.tableName}\` WHERE id = $id AND hash = Digest::NumericHash($id);`
    this.writeQuery = `DECLARE $id AS Uint64;
DECLARE $payload_str AS Utf8;
DECLARE $payload_double AS Double;
DECLARE $payload_timestamp AS Timestamp;
UPSERT INTO \`${this.tableName}\` (
  id, hash, payload_str, payload_double, payload_timestamp
) VALUES (
  $id, Digest::NumericHash($id), $payload_str, $payload_double, $payload_timestamp
);`
    this.readExecuteQuerySettings = new ExecuteQuerySettings()
      .withKeepInCache(true)
      .withOperationParams(
        new OperationParams().withOperationTimeout({
          nanos: readTimeout * 1000 * 1000,
        })
      )
    this.writeExecuteQuerySettings = new ExecuteQuerySettings()
      .withKeepInCache(true)
      .withOperationParams(
        new OperationParams().withOperationTimeout({
          nanos: writeTimeout * 1000 * 1000,
        })
      )

    this.gateway = new Pushgateway(
      pushGateway,
      {
        timeout: 10000,
        agent: new http.Agent({
          keepAlive: true,
          keepAliveMsecs: 20000,
          maxSockets: 5,
        }),
      },
      this.registry
    )

    this.registry.setDefaultLabels({ sdk: 'nodejs', sdkVersion })
    const registers = [this.registry]

    this.oks = new Gauge({
      name: 'oks',
      help: 'amount of OK requests',
      registers,
      labelNames: ['jobName'],
    })
    this.notOks = new Gauge({
      name: 'not_oks',
      help: 'amount of not OK requests',
      registers,
      labelNames: ['jobName'],
    })
    this.inflight = new Gauge({
      name: 'inflight',
      help: 'amount of requests in flight',
      registers,
      labelNames: ['jobName'],
    })
    this.latencies = new Summary({
      name: 'latency',
      help: 'histogram of latencies in ms',
      percentiles,
      registers,
      labelNames: ['status', 'jobName'],
      // add more options?
    })
    this.realRPS = new Gauge({
      name: 'realRPS',
      help: 'Real sended requests per seconds',
      registers,
      labelNames: ['jobName'],
    })
  }

  /** Stop collecting metrics to prevent non-null values after resetting them */
  stopCollectingMetrics() {
    this.collectingMetrics = false
  }

  withSession(jobName: string) {
    return async <T>(callback: (session: Session) => Promise<T>, timeout?: number): Promise<T> => {
      if (this.collectingMetrics) this.inflight.inc({ jobName }, 1)
      let result: any
      const startSession = new Date().valueOf()
      let endSession: number
      try {
        result = await this.driver.tableClient.withSession(callback, timeout)
        endSession = new Date().valueOf()
        if (this.collectingMetrics) {
          this.latencies.observe({ status: 'ok', jobName }, endSession - startSession)
          this.oks.inc({ jobName })
        }
      } catch (error) {
        endSession = new Date().valueOf()
        console.log(error)
        if (this.collectingMetrics) {
          this.latencies.observe({ status: 'err', jobName }, endSession - startSession)
          this.notOks.inc({ jobName })
        }
      }
      if (this.collectingMetrics) this.inflight.dec({ jobName }, 1)
      return result
    }
  }

  async printStats(file?: string) {
    const json = await this.registry.getMetricsAsJSON()
    if (file) {
      await writeFile(file, JSON.stringify(json))
    }
    console.log(
      '========== Stats: ========== \n\n',
      JSON.stringify(json),
      '========== Stats end =========='
    )
  }

  async pushStats() {
    await this.gateway.pushAdd({ jobName: 'workload-nodejs' })
  }
  resetStats() {
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
}
