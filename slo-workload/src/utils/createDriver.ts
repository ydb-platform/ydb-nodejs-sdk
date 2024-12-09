import { AnonymousAuthService, Driver } from 'ydb-sdk'

export async function createDriver(endpoint: string, database: string): Promise<Driver> {
    console.log('Driver initializing...')

    const driver = new Driver({
        endpoint,
        database,
        authService: new AnonymousAuthService(),
        poolSettings: { minLimit: 10 },
    })

    const timeout = 30000
    if (!(await driver.ready(timeout))) {
        console.log(`Driver has not become ready in ${timeout}ms!`)
        process.exit(1)
    }
    console.log('Initialized succesfully')
    return driver
}
