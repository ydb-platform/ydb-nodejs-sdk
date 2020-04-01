# How to use
## Install dependencies and compile sources
```bash
npm ci
npm run build
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
export YDB_SSL_ROOT_CERTIFICATES_FILE=
export YDB_SDK_LOGLEVEL=debug
```

### For Yandex.Cloud YDB cluster
```bash
export YDB_TOKEN=
export SA_PRIVATE_KEY_FILE= # here should be the path to the file with your service account's private key
export YDB_SSL_ROOT_CERTIFICATES_FILE= # here should be the path to ssl root certificate for YDB installation 
export IAM_ENDPOINT= # by default it is iam.api.cloud.yandex.net:443
export SA_ID= # here come you service account's id
export SA_ACCESS_KEY_ID= # here comes your service account's key id
export ENTRYPOINT=grpcs:// # here comes your cloud entrypoint hostname
export DB= # here comes your cloud db name
export YDB_SDK_LOGLEVEL=debug
```

## Run basic-example script
```bash
npm start  
```
