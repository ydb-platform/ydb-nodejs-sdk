import http from 'http'
import { Counter, Registry, Pushgateway, Histogram, Gauge } from 'prom-client'
import { Driver, Session } from 'ydb-sdk'
import { QueryBuilder } from './QueryBuilder'
import { version as sdkVersion } from '../../../package.json'

export default class Executor {
  private readonly driver: Driver
  private readonly registry = new Registry()
  private readonly gateway: Pushgateway
  readonly tableName: string
  readonly stopTime: number
  readonly qb: QueryBuilder

  private readonly errorsTotal: Counter
  private readonly operationsTotal: Counter
  private readonly operationsSuccessTotal: Counter
  private readonly operationsFailureTotal: Counter
  private readonly operationLatencySeconds: Histogram
  private readonly retryAttempts: Gauge
  private readonly retryAttemptsTotal: Counter
  private readonly retriesSuccessTotal: Counter
  private readonly retriesFailureTotal: Counter
  private readonly pendingOperations: Gauge

  constructor(
    driver: Driver,
    workload: string,
    pushGateway: string,
    tableName: string,
    runTimeSecs: number,
    readTimeout: number,
    writeTimeout: number
  ) {
    this.driver = driver
    this.tableName = tableName
    this.stopTime = new Date().valueOf() + runTimeSecs * 1000
    this.qb = new QueryBuilder(tableName, readTimeout, writeTimeout)

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

    this.registry.setDefaultLabels({
      "ref": process.env.REF || 'main',
      "sdk": "ydb-nodejs-sdk",
      "sdk_version": sdkVersion,
      "workload": workload,
      "workload_version": "0.0.0",
    })

    const registers = [this.registry]

    this.errorsTotal = new Counter({
      name: 'sdk_errors_total',
      help: 'Total number of errors encountered, categorized by error type.',
      registers,
        labelNames: ['operation_type','error_type'],
    })

    this.operationsTotal = new Counter({
      name: 'sdk_operations_total',
      help: 'Total number of operations, categorized by type attempted by the SDK.',
      registers,
      labelNames: ['operation_type'],
    })

    this.operationsSuccessTotal = new Counter({
      name: 'sdk_operations_success_total',
      help: 'Total number of successful operations, categorized by type.',
      registers,
      labelNames: ['operation_type'],
    })

    this.operationsFailureTotal = new Counter({
      name: 'sdk_operations_failure_total',
      help: 'Total number of failed operations, categorized by type.',
      registers,
      labelNames: ['operation_type'],
    })

    this.operationLatencySeconds = new Histogram({
      name: "sdk_operation_latency_seconds",
      help: "Latency of operations performed by the SDK in seconds, categorized by type and status.",
      buckets: [
        0.001,  // 1 ms
        0.002,  // 2 ms
        0.003,  // 3 ms
        0.004,  // 4 ms
        0.005,  // 5 ms
        0.0075, // 7.5 ms
        0.010,  // 10 ms
        0.020,  // 20 ms
        0.050,  // 50 ms
        0.100,  // 100 ms
        0.200,  // 200 ms
        0.500,  // 500 ms
        1.000,  // 1 s
      ],
      registers,
      labelNames: ["operation_type", "operation_status"]
    })

    this.retryAttempts = new Gauge({
      name: "sdk_retry_attempts",
      help: "Current retry attempts, categorized by operation type.",
      registers,
      labelNames: ["operation_type"],
    })

    this.retryAttemptsTotal = new Counter({
      name: "sdk_retry_attempts_total",
      help: "Total number of retry attempts, categorized by operation type.",
      registers,
      labelNames: ["operation_type"],
    })

    this.retriesSuccessTotal = new Counter({
      name: "sdk_retries_success_total",
      help: "Total number of successful retries, categorized by operation type.",
      registers,
      labelNames: ["operation_type"],
    })

    this.retriesFailureTotal = new Counter({
      name: "sdk_retries_failure_total",
      help: "Total number of failed retries, categorized by operation type.",
      registers,
      labelNames: ["operation_type"],
    })

    this.pendingOperations = new Gauge({
      name: "sdk_pending_operations",
      help: "Current number of pending operations, categorized by type.",
      registers,
      labelNames: ["operation_type"],
    })
  }


  withSession(operation_type: string) {
    return async <T>(callback: (session: Session) => Promise<T>, timeout?: number): Promise<T> => {
      this.pendingOperations.inc({ operation_type }, 1)

      let result: any
      let success = false
      const startSession = new Date().valueOf()
      let endSession: number

      try {
        result = await this.driver.tableClient.withSession(callback, timeout)
        success = true
        this.operationsSuccessTotal.inc({ operation_type })
      } catch (error) {
        console.log(error)
        this.errorsTotal.inc({ operation_type })
        this.operationsFailureTotal.inc({ operation_type })
      } finally {
        endSession = new Date().valueOf()
        this.operationsTotal.inc({ operation_type })
        this.pendingOperations.dec({ operation_type }, 1)
        this.operationLatencySeconds.observe({ operation_status: success ? 'success' : 'failure', operation_type }, (endSession - startSession) / 100)
      }

      return result
    }
  }

  async printStats() {
    const json = await this.registry.getMetricsAsJSON()
    console.log(
      '========== Stats: ========== \n',
      JSON.stringify(json),
      '\n========== Stats end =========='
    )
  }

  async pushStats() {
    await this.gateway.pushAdd({ jobName: 'workload-table' })
  }
}
