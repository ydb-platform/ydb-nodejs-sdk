import {discoverEndpoints} from './discovery';


const DB_PATH_NAME = '/ru-prestable/home/tsufiev/mydb';
const DB_ENTRYPOINT = 'ydb-ru-prestable.yandex.net:2135';

discoverEndpoints(DB_ENTRYPOINT, DB_PATH_NAME)
    .then((result) => console.log(result))
    .catch((err) => console.error(err));
