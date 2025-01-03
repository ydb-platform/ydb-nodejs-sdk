import { program } from 'commander'
import { cleanup } from './cleanup'
import { create } from './create'
import { MetricsJob } from './metricsJob'
import { readJob } from './readJob'
import { createDriver } from './utils/createDriver'
import {
  TABLE_NAME,
  SHUTDOWN_TIME,
  PROMETHEUS_PUSH_GATEWAY,
  PROMETHEUS_PUSH_PERIOD,
  READ_TIME,
  READ_TIMEOUT,
  WRITE_TIMEOUT,
} from './utils/defaults'
import Executor from './utils/Executor'
import { writeJob } from './writeJob'
import { DataGenerator } from './utils/DataGenerator'

const defaultArgs = (p: typeof program) => {
  return p
    .argument('<endpoint>', 'YDB endpoint to connect to')
    .argument('<db>', 'YDB database to connect to')
}

interface ICreateOptions {
  tableName?: string
  minPartitionsCount?: string
  maxPartitionsCount?: string
  partitionSize?: string
  initialDataCount?: string
}

function main() {
  program
    .name('slo-nodejs-workload')
    .description('Node.js util to run SLO workload over YDB cluster. Uses credentials from env.')

  // create
  defaultArgs(program.command('create'))
    .option('-t --table-name <tableName>', 'table name to create', 'key_value')
    .option('--min-partitions-count <minPartitionsCount>', 'minimum amount of partitions in table')
    .option('--max-partitions-count <maxPartitionsCount>', 'maximum amount of partitions in table')
    .option('--partition-size <partitionSize>', 'partition size in mb')
    .option('-c --initial-data-count <initialDataCount>', 'amount of initially created rows')
    .action(
      async (
        endpoint,
        db,
        {
          tableName,
          minPartitionsCount,
          maxPartitionsCount,
          partitionSize,
          initialDataCount,
        }: ICreateOptions
      ) => {
        console.log('Run create over', endpoint, db, {
          tableName,
          minPartitionsCount,
          initialDataCount,
          maxPartitionsCount,
          partitionSize,
        })
        await create(
          await createDriver(endpoint, db),
          tableName,
          minPartitionsCount,
          maxPartitionsCount,
          partitionSize,
          initialDataCount
        )
      }
    )

  defaultArgs(program.command('cleanup'))
    .option('-t --table-name <tableName>', 'table name to create', 'key_value')
    .action(async (endpoint, db, { tableName }) => {
      console.log('Run cleanup over', endpoint, db, { tableName })
      await cleanup(await createDriver(endpoint, db), db, tableName)
    })

  defaultArgs(program.command('run'))
    .option('-t --table-name <tableName>', 'table name to read from', 'key_value')
    .option('--prom-pgw <promPgw>', 'prometheus push gateway', 'http://localhost:9091')
    .option('--read-rps <readRps>', 'read RPS', '1000')
    .option('--read-timeout <readTimeout>', 'read timeout milliseconds', '10000')
    .option('--write-rps <writeRps>', 'write RPS', '100')
    .option('--write-timeout <writeTimeout>', 'write timeout milliseconds', '10000')
    .option('--time <time>', 'run time in seconds', '600')
    .option('--shutdown-time <shutdownTime>', 'graceful shutdown time in seconds', '30')
    .option('--report-period <reportPeriod>', 'prometheus push period in milliseconds', '250')
    .action(async (endpoint, db, params) => {
      let {
        tableName,
        readRps,
        readTimeout,
        writeRps,
        writeTimeout,
        time,
        shutdownTime,
        promPgw,
        reportPeriod,
      } = params

      if (!tableName) tableName = TABLE_NAME
      if (!time) time = READ_TIME
      if (!shutdownTime) shutdownTime = SHUTDOWN_TIME
      if (!promPgw) promPgw = PROMETHEUS_PUSH_GATEWAY
      if (!reportPeriod) reportPeriod = PROMETHEUS_PUSH_PERIOD
      if (!readTimeout) readTimeout = READ_TIMEOUT
      if (!writeTimeout) writeTimeout = WRITE_TIMEOUT

      time = +time
      shutdownTime = +shutdownTime

      console.log('Run workload over', {
        tableName,
        time,
        shutdownTime,
        promPgw,
        reportPeriod,
        readTimeout,
        writeTimeout,
      })

      const driver = await createDriver(endpoint, db)
      const executor = new Executor(driver, 'TableService K/V', promPgw, tableName, time, readTimeout, writeTimeout)

      // metricsJob works all write/read time + shutdown time
      const metricsJob = new MetricsJob(executor, reportPeriod, time + shutdownTime).getPromise()

      await DataGenerator.loadMaxId(driver, tableName)
      console.log('Max id', DataGenerator.getMaxId())
      await executor.printStats()

      await Promise.all([
        readJob(executor, readRps),
        writeJob(executor, writeRps),
        metricsJob
      ])

      await new Promise((resolve) => setTimeout(resolve, shutdownTime * 1000))
      await executor.pushStats()
      process.exit(0)
    })

  program.parse()
}

main()
