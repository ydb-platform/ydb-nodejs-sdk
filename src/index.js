const {getEndpoint} = require('./discovery');
const {createSession} = require('./table');

const DB_PATH_NAME = '/ru-prestable/home/tsufiev/mydb';
const DB_ENDPOINT = 'ydb-ru-prestable.yandex.net:2135';
getEndpoint(DB_ENDPOINT, DB_PATH_NAME)
    .then((endpoint) => {
        createSession(endpoint)
            .then(console.log)
    })
