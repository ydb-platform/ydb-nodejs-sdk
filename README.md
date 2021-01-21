# How to use
## Install dependencies and compile library
```bash
npm ci
npm run build:lib
```

## Set environment variables for proper authentication
Variables which should not be set for a specific installation are explicitly set to an empty value,
so that startup script correctly detects which installation you are aiming at.
### For internal YDB cluster
```bash
export SA_ID=
export YDB_TOKEN= # here comes your oauth token
export ENTRYPOINT=grpc:// # here comes your internal entrypoint hostname
export DB= # here comes your internal db name
export YDB_SSL_ROOT_CERTIFICATES_FILE= # optional
export YDB_SDK_LOGLEVEL=debug
```

### For Yandex.Cloud YDB cluster
```bash
export YDB_TOKEN=
export SA_PRIVATE_KEY_FILE= # here should be the path to the file with your service account's private key
export YDB_SSL_ROOT_CERTIFICATES_FILE= # here should be the path to ssl root certificate for YDB installation, optional
export IAM_ENDPOINT= # by default it is iam.api.cloud.yandex.net:443
export SA_ID= # here come you service account's id
export SA_ACCESS_KEY_ID= # here comes your service account's key id
export ENTRYPOINT=grpcs:// # here comes your cloud entrypoint hostname
export DB= # here comes your cloud db name
export YDB_SDK_LOGLEVEL=debug
```

### Run Docapi example
```bash
export DOCAPI_ENTRYPOINT= # for docapi-example, like https://docapi.serverless.yandexcloud.net/ru-central1/b1g11111111111111111/etn22222222222222222
export YDB_TOKEN=
cd examples
npm ci
npm run build
npm run docapi
```

## Run basic-example script
```bash
(cd examples && npm ci)
npm run build:examples
npm start
```
