import {DocAPIService} from "yandex-cloud/lib/slydb/docapi/docapi";

const {Session} = require("yandex-cloud")

function main() {
    let token = process.env['YDB_TOKEN'];
    const session = new Session(token ? { oauthToken: token } : {});
    var endpoint = process.env['DOCAPI_ENDPOINT'];
    if (endpoint == null) {
        console.error('DOCAPI_ENDPOINT required')
        process.exit(1)
    }
    const docapi = new DocAPIService(endpoint, session)
    run(docapi).then(() => {})
        .catch((e) => {
            console.error(e);
            process.exit(1);
        });
}

async function createTable(docapi: DocAPIService, tableName: string) {
    return docapi.createTable({
        AttributeDefinitions: [
            {AttributeName: "species", AttributeType: "S"},
            {AttributeName: "name", AttributeType: "S"},
        ],
        TableName: tableName,
        KeySchema: [
            {AttributeName: "species", KeyType: "HASH"},
            {AttributeName: "name", KeyType: "RANGE"},
        ],
        BillingMode: 'PAY_PER_REQUEST',
    })
}

async function loadData(docapi: DocAPIService, tableName: string) {
    return docapi.batchWriteItem({
        ReturnConsumedCapacity: "TOTAL",
        RequestItems: {
            [tableName]: [
                {
                    PutRequest: {
                        Item: {
                            "species": "cat",
                            "name": "Tom",
                            "color": "black",
                            "price": 10,
                        }
                    },
                },
                {
                    PutRequest: {
                        Item: {
                            "species": "cat",
                            "name": "Mamba",
                            "color": "white",
                            "price": 12,
                        }
                    },
                },
                {
                    PutRequest: {
                        Item: {
                            "species": "dog",
                            "name": "Rex",
                            "color": "brown",
                            "price": 22,
                        }
                    },
                },
            ]
        }
    })
}

async function queryCats(docapi: DocAPIService, tableName: string) {
    return docapi.query({
        TableName: tableName,
        ConsistentRead: true,
        KeyConditionExpression: 'species = :c',
        ExpressionAttributeValues: {':c': 'cat'},
    })
}

async function deleteCat(docapi: DocAPIService, tableName: string) {
       return docapi.deleteItem({
           TableName: tableName,
           Key: {
               'species': 'cat',
               'name': 'Tom',
           },
           ReturnValues: "ALL_OLD",
       })
}

async function run(docapi: DocAPIService) {
    const tableName = 'example' + Date.now()
    const tableDescription = await createTable(docapi, tableName)
    console.log('Table created: ', JSON.stringify(tableDescription))

    await loadData(docapi, tableName)

    const scanResult = await docapi.scan({TableName: tableName})
    console.log('Scan result: ', scanResult)

    const rex = await docapi.getItem({
        TableName: tableName,
        ConsistentRead: true,
        Key: {
            "species": "dog",
            "name": "Rex",
        }
    })
    console.log("Got Rex: ", rex)

    const cats = await queryCats(docapi, tableName)
    console.log('Found cats: ', cats)

    const deleted = await deleteCat(docapi, tableName)
    console.log("Deleted: ", deleted)
    const remainingCats = await queryCats(docapi, tableName)
    console.log('Remaining cats: ', remainingCats)

    await docapi.deleteTable({TableName: tableName})
}

main()

