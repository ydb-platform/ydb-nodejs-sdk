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
} from './utils/defaults'
import Executor from './utils/Executor'
import { getMaxId } from './utils/getMaxId'
import { writeJob } from './writeJob'

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
    .option('-t --table-name <tableName>', 'table name to create')
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
          db,
          tableName,
          minPartitionsCount,
          maxPartitionsCount,
          partitionSize,
          initialDataCount
        )
      }
    )

  defaultArgs(program.command('cleanup'))
    .option('-t --table-name <tableName>', 'table name to create')
    .action(async (endpoint, db, { tableName }) => {
      console.log('Run cleanup over', endpoint, db, { tableName })
      await cleanup(await createDriver(endpoint, db), db, tableName)
    })

  defaultArgs(program.command('run'))
    .option('-t --table-name <tableName>', 'table name to read from')
    .option('--prom-pgw <promPgw>', 'prometheus push gateway')
    .option('--read-rps <readRps>', 'read RPS')
    .option('--read-timeout <readTimeout>', 'read timeout milliseconds')
    .option('--write-rps <writeRps>', 'write RPS')
    .option('--write-timeout <writeTimeout>', 'write timeout milliseconds')
    .option('--time <time>', 'run time in seconds')
    .option('--shutdown-time <shutdownTime>', 'graceful shutdown time in seconds')
    .option('--report-period <reportPeriod>', 'prometheus push period in milliseconds')
    .action(
      async (
        endpoint,
        db,
        {
          tableName,
          readRps,
          readTimeout,
          writeRps,
          writeTimeout,
          time,
          shutdownTime,
          promPgw,
          reportPeriod,
        }
      ) => {
        if (!tableName) tableName = TABLE_NAME
        if (!shutdownTime) shutdownTime = SHUTDOWN_TIME
        if (!promPgw) promPgw = PROMETHEUS_PUSH_GATEWAY
        if (!reportPeriod) reportPeriod = PROMETHEUS_PUSH_PERIOD
        console.log('Run workload over', {
          tableName,
          readRps,
          readTimeout,
          writeRps,
          writeTimeout,
          time,
          shutdownTime,
          promPgw,
        })

        const driver = await createDriver(endpoint, db)
        const maxId = await getMaxId(driver, tableName)
        console.log('Max id', { maxId })
        const executor = new Executor(driver, promPgw)
        const metricsJob = new MetricsJob(executor, reportPeriod, time + shutdownTime)

        await executor.printStats()
        await executor.pushStats()
        await Promise.all([
          readJob(executor, tableName, maxId, readRps, readTimeout, time),
          writeJob(executor, tableName, maxId, writeRps, writeTimeout, time),
          metricsJob,
        ])
        await new Promise((resolve) => setTimeout(resolve, shutdownTime * 1000))
        await executor.pushStats()
        await executor.printStats('runStats.json')
        console.log('Reset metrics')
        executor.stopCollectingMetrics()
        await executor.resetStats()
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await executor.pushStats()
        process.exit(0)
      }
    )

  program.parse()
}

main()
