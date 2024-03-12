import Driver from '../../../driver';
import {initDriver, destroyDriver} from "../../../utils/test";
import {QuerySession} from "../../../query/query-session";

const getTableName = () => `table_create_${Math.trunc(100000 * Math.random())}`;

describe('Create table', () => {
    let driver: Driver;

    beforeAll(async () => {
        driver = await initDriver();
    });

    afterAll(async () => await destroyDriver(driver));

    it('Simple usage with indexes', async () => {
        const tableName = getTableName();
        /*const res =*/ await driver.queryClient.do({
            // ctx: ,
            // tx: ,
            // idempotent: ,
            fn: async (session: QuerySession) => {
                /*const res =*/ session.execute({
                    // tx:
                    txControl: {
                      beginTx: {
                          serializableReadWrite: {

                          }
                      },
                      commitTx: false,
                    },
                    queryContent: {
                        text: `create table ${tableName} {
                            id UInt64,
                            title Utf8,
                            time Timestamp,
                            PRIMARY KEY
                               (
                                   id
                               )
                            }`
                    },

                    // rowMode: ,
                    // keepInCache: , // ???
                    // timeout: ,
                });

                // TODO: Proper work with types - mapping as in table.queue or dynamic defaults to json
                // TODO; Optimize typing by performance

                // for await (const rs of result.resultSets) {
                //     console.info(2000);
                //     const cols = await resultSet.getCols();
                //     for await (const row of resultSet.rows) {
                //         console.info(2100);
                //     }
                //
                // }

                // for await (const v of res) {
                //     console.info(6000, v);
                // }

                return 12;
            },
        });

        // TODO: Insert data
        // TODO: Select data in multiple resoultSets
    });
});
