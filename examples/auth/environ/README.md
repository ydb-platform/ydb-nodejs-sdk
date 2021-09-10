# Authenticate with environ

`environ` example provides the code snippet for authenticating to YDB with the access token credentials.

Authentication is performed with one of next environment variables:

* YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS=<path/to/sa_key_file> — used service account key file by path
* YDB_ANONYMOUS_CREDENTIALS="1" — used for authenticate with anonymous access. Anonymous access needs for connect to testing YDB installation
* YDB_METADATA_CREDENTIALS="1" — used metadata service for authenticate to YDB from Yandex Cloud virtual machine or from Yandex Function
* YDB_ACCESS_TOKEN_CREDENTIALS=<access_token> — used for authenticate to YDB with short-life access token. For example, access token may be IAM token

## Running code snippet
```bash
YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS=/Users/user/.ydb/sa.json node environ --connection-string "grpcs://endpoint/?database=database"
# or
YDB_ANONYMOUS_CREDENTIALS="1" node environ --connection-string "grpcs://endpoint/?database=database"
# or
YDB_METADATA_CREDENTIALS="1" node environ --connection-string "grpcs://endpoint/?database=database"
# or
YDB_ACCESS_TOKEN_CREDENTIALS="YDB_ACCESS_TOKEN" node environ --connection-string "grpcs://endpoint/?database=database"
```
