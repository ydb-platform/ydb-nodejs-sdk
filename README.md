# How to use
## Install package from NPM
```bash
npm install ydb-sdk
```

## Install dependencies and compile library
```bash
npm ci
npm run build
```

## Set environment variables
Variables which should not be set for a specific installation are explicitly set to an empty value,
so that startup script correctly detects which installation you are aiming at.

### Common variables
```bash
export YDB_SDK_LOGLEVEL=debug
export IAM_ENDPOINT= # for Yandex.Cloud, by default it is iam.api.cloud.yandex.net:443
````

### Credential variables
For the typical cases of using these variables, see below:
```bash
export YDB_ACCESS_TOKEN_CREDENTIALS= # here comes your token from `yc iam create-token`

export YDB_ANONYMOUS_CREDENTIALS=1 # try anonymous access

export YDB_METADATA_CREDENTIALS=1 #  try local metadata service authentication

export YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS = # here should be the path to the service account key file from 'yc iam key create --folder-id <folder_id> --service-account-name <sa_name> --output ~/.ydb/sa_name.json'
```

### Access to internal YDB cluster
```bash
export YDB_ACCESS_TOKEN_CREDENTIALS= # here comes your oauth token
```

### Access to Yandex.Cloud YDB cluster from local machine
#### Serverless DB
```bash
export YDB_ACCESS_TOKEN_CREDENTIALS= # here comes your token from `yc iam create-token`
```

#### Dedicated DB
```bash
export YDB_ACCESS_TOKEN_CREDENTIALS= # here comes your token from `yc iam create-token`
export YDB_SSL_ROOT_CERTIFICATES_FILE= # here should be the path to ssl root certificate for YDB installation
```

### Access to Yandex.Cloud YDB cluster from virtual machine
```bash
export YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS= # here should be the path to the service account key file from 'yc iam key create --folder-id <folder_id> --service-account-name <sa_name> --output ~/.ydb/sa_name.json'
```

## Run basic-example script
```bash
cd examples
npm ci
npm run build
npm run basic-v1 -- --connection-string grpcs://your.cloud.endpoint.hostname?database=your-cloud-db-name
```
