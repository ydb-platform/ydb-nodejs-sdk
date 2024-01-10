# SLO development guid

### Start local environment

In the [slo-tests](https://github.com/ydb-platform/slo-tests) project in the _playground_ folder

  `run docker compose up -d`

### Check everything in the browserCheck everything in the browser

In the browser, open

* [Grafana](http://localhost:3000/)

* [YDB](http://localhost:8765/)

### Configure local console to run SLO tests

In the [ydb-nodejs-sdk](https://github.com/ydb-platform/ydb-nodejs-sdk) project
in the slo-workload folder

  `npm i`

  `set YDB_ANONYMOUS_CREDENTIALS=1`

  `set YDB_SSL_ROOT_CERTIFICATES_FILE=../[slo-tests](https://github.com/ydb-platform/slo-tests)/playground/data/ydb_certs/ca.pem`

### Create a test base

  `npx ts-node src/index.ts create grpcs://localhost:2135 local`

### Run the test - for 5 min

  `npx ts-node src/index.ts run grpcs://localhost:2135 local`

### Clean the baseClean the base
  `npx ts-node src/index.ts clear grpcs://localhost:2135 local`

### What to do in case of test problems

* Restart the environment

  `docker compose down`

  `docker compose up -d`

* Repeat the tests several times. There are floating errors because the tests are integration tests. So the picture may vary from one run to another
