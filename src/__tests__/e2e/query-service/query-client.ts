// import {destroyDriver, initDriver} from "../../../utils/test";
import Driver from "../../../driver";
import {AnonymousAuthService} from "../../../credentials/anonymous-auth-service";

const DATABASE = '/local';
const ENDPOINT = 'grpcs://localhost:2136';
// const TABLE_NAME = 'test_table_20240313'

describe('Query client', () => {

    let driver: Driver;

    beforeAll(async () => {
        driver = new Driver(Object.assign({
            endpoint: ENDPOINT,
            database: DATABASE,
            authService: new AnonymousAuthService(),
        }));
        if (!(await driver.ready(3000))) throw new Error('Driver is not ready!');
    });

    afterAll(async () => await driver?.destroy());

    it('Query client do()', async () => {

    });

    it('Query client doTx()', async () => {

    });

    it('Auto commit or rollback', async () => {

    });
});
