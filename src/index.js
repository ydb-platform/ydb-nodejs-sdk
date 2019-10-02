const {discoverEndpoints} = require('./discovery');

const DB_PATH_NAME = '/ru-prestable/home/tsufiev/mydb';
const DB_ENDPOINT = 'ydb-ru-prestable.yandex.net:2135';
discoverEndpoints(DB_ENDPOINT, DB_PATH_NAME)
    .then(console.log);
