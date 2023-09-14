import {Driver, TokenAuthService} from 'ydb-sdk';

(async function () {
    const driver = new Driver({
        connectionString: process.env.YDB_CONNECTION_STRING,
        authService: new TokenAuthService(process.env.YDB_TOKEN as string),
    });
    try {
        await driver.tableClient.withSession(async (session) => {
            const preparedQuery = await session.prepareQuery("SELECT 1");
            const txMeta = await session.beginTransaction({snapshotReadOnly: {}});
            const txId = txMeta.id as string;
            await session.executeQuery(preparedQuery, {}, {txId});
            await session.commitTransaction({txId});
        });
    } finally {
        await driver.destroy();
    }
})();
