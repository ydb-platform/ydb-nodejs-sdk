import { Driver, getCredentialsFromEnv } from 'ydb-sdk'

export async function createDriver(endpoint: string, database: string): Promise<Driver> {
  const authService = getCredentialsFromEnv()
  console.log('Driver initializing...')
  const logFunction = (lvl: string, suppress: boolean = false) => {
    return (msg: string, ...args: any[]) =>
      !suppress && console.log(`[${new Date().toISOString()}] ${lvl} ${msg}`, args)
  }
  const logger = {
    trace: logFunction('trace', true),
    debug: logFunction('debug'),
    fatal: logFunction('fatal'),
    error: logFunction('error'),
    warn: logFunction('warn'),
    info: logFunction('info'),
  }
  const driver = new Driver({
    endpoint,
    database,
    authService,
    poolSettings: { minLimit: 10 },
    // logger,
  })

  const timeout = 30000
  if (!(await driver.ready(timeout))) {
    console.log(`Driver has not become ready in ${timeout}ms!`)
    process.exit(1)
  }
  console.log('Initialized succesfully')
  return driver
}
