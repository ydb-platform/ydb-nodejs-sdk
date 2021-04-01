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
export YDB_SSL_ROOT_CERTIFICATES_FILE= # optional
export YDB_SDK_LOGLEVEL=debug
```

### For Yandex.Cloud YDB cluster
```bash
export YDB_TOKEN= # here comes your token from `yc iam create-token` OR next 3 vars

export SA_PRIVATE_KEY_FILE= # here should be the path to the file with your service account's private key
export SA_ID= # here come you service account's id
export SA_ACCESS_KEY_ID= # here comes your service account's key id

export YDB_SSL_ROOT_CERTIFICATES_FILE= # here should be the path to ssl root certificate for YDB installation, optional
export IAM_ENDPOINT= # by default it is iam.api.cloud.yandex.net:443
export YDB_SDK_LOGLEVEL=debug
```

## Run basic-example script
```bash
(cd examples && npm ci)
npm run build:examples
npm start -- -- -- --endpoint your-cloud-endpoint-hostname --db your-cloud-db-name
```
