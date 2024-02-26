import {parseConnectionString} from "../../../utils/parse-connection-string";

describe('Parse connection string', () => {
    it('test parseConnectionString', () => {
        const tests = [
            {
                connectionString: 'ydb-ru.yandex.net:2135/?database=/ru/home/service/db',
                endpoint: 'grpcs://ydb-ru.yandex.net:2135',
                database: '/ru/home/service/db',
            },
            {
                connectionString: 'grpc://ydb-ru.yandex.net:2135/?database=/ru/home/service/db',
                endpoint: 'grpc://ydb-ru.yandex.net:2135',
                database: '/ru/home/service/db',
            },
            {
                connectionString: 'grpcs://ydb-ru.yandex.net:2135/?database=/ru/home/service/db',
                endpoint: 'grpcs://ydb-ru.yandex.net:2135',
                database: '/ru/home/service/db',
            },
            {
                connectionString: "grpcs://ydb.serverless.yandexcloud.net:2135/?database=/ru-central1/b1g8skpblkos03malf3s/etn03nohfn502cpa0cfe",
                endpoint: "grpcs://ydb.serverless.yandexcloud.net:2135",
                database: "/ru-central1/b1g8skpblkos03malf3s/etn03nohfn502cpa0cfe"
            }
        ];

        tests.forEach((test) => {
            const parsedString = parseConnectionString(test.connectionString);
            expect(parsedString).toEqual({endpoint: test.endpoint, database: test.database});
        });
    });
});
