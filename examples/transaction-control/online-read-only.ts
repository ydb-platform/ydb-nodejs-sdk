import {Driver, TokenAuthService} from 'ydb-sdk';

(async function () {
    const driver = new Driver({
        connectionString: process.env.YDB_CONNECTION_STRING,
        authService: new TokenAuthService(process.env.YDB_TOKEN as string),
    });
    try {
        await driver.tableClient.withSession(async (session) => {
            const preparedQuery = await session.prepareQuery("SELECT 1");
            await session.executeQuery(preparedQuery, {}, {beginTx: {onlineReadOnly: {allowInconsistentReads: false}}, commitTx: true});
        });
    } finally {
        await driver.destroy();
    }
})();
