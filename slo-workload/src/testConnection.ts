import {Driver, getCredentialsFromEnv} from 'ydb-sdk';

async function run(endpoint: string, database: string) {
    console.log('Driver initializing...');
    const authService = getCredentialsFromEnv();
    const driver = new Driver({endpoint, database, authService});
    const timeout = 10000;
    if (!await driver.ready(timeout)) {
        console.log(`Driver has not become ready in ${timeout}ms!`);
        process.exit(1);
    }
    console.log('Initialized succesfully');
    process.exit(0)
}

run(process.argv[2], process.argv[3])