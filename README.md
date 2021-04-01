# How to use
## Install dependencies and compile library
```bash
npm ci
npm run build:lib
```

## Set environment variables
Variables which should not be set for a specific installation are explicitly set to an empty value,
so that startup script correctly detects which installation you are aiming at.

### Common variables
```bash
export YDB_SDK_LOGLEVEL=debug
export IAM_ENDPOINT= # for Yandex.Cloud, by default it is iam.api.cloud.yandex.net:443
````

### Access to internal YDB cluster
```bash
export SA_ID=
export YDB_TOKEN= # here comes your oauth token
```

### Access to Yandex.Cloud YDB cluster from local machine
#### Serverless DB
```bash
export YDB_TOKEN= # here comes your token from `yc iam create-token`
```

#### Dedicated DB
```bash
export YDB_TOKEN= # here comes your token from `yc iam create-token`
export YDB_SSL_ROOT_CERTIFICATES_FILE= # here should be the path to ssl root certificate for YDB installation
```

### Access to Yandex.Cloud YDB cluster from virtual machine
```bash
export SA_PRIVATE_KEY_FILE= # here should be the path to the file with your service account's private key
export SA_ID= # here come you service account's id
export SA_ACCESS_KEY_ID= # here comes your service account's key id
```

## Run basic-example script
```bash
cd examples
npm ci
npm run build
npm run basic-v1 -- --endpoint your-cloud-endpoint-hostname --db your-cloud-db-name
```
