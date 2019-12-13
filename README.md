# How to use
## Install dependencies and compile sources
```bash
npm ci
npm run build
```

## Set environment variables for proper authentication
### For internal YDB cluster
```bash
export YDB_TOKEN= # here comes your oauth token
export ENTRYPOINT= # here comes your internal entrypoint
export DB= # here comes your internal db name
```

### For Yandex.Cloud YDB cluster
```bash
export SA_PRIVATE_KEY_FILE= # here should be the path to the file with your service account's private key
export YDB_SSL_ROOT_CERTIFICATES_FILE= # here should be the path to ssl root certificate for YDB installation 
export IAM_ENDPOINT= # by default it is iam.api.cloud.yandex.net:443
export SA_ID= # here come you service account's id
export SA_ACCESS_KEY_ID= # here comes your service account's key id
export ENTRYPOINT= # here comes your cloud entrypoint
export DB= # here comes your cloud db name
```

## Run basic-example script
```bash
npm start  
```
