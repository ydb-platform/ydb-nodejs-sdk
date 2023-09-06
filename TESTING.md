## Install ydb-platform/slo-tests

GIT: https://github.com/ydb-platform/slo-tests.git
Start `docker-compose up -d` to have YDB running in local container
Check that НВИ has started `http://localhost:8765/monitoring/cluster/tenants`

## Install

set YDB_ANONYMOUS_CREDENTIALS=1
set YDB_SSL_ROOT_CERTIFICATES_FILE=C:\work\slo-tests\playground\data\ydb_certs\cert.pem
set YDB_SDK_LOGLEVEL=debug
npm run test:integration:development

src/__tests__/bytestring-identity.test.ts
src/__tests__/create-table.test.ts

