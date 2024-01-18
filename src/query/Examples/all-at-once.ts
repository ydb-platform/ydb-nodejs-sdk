import Driver from '../../driver'

async function Main() {

    // TODO; Add service to Driver
    const ydb = new Driver({
        // endpoint: '...',
        // database: '...',
        // connectionString: '...',
        // authService: ...,
        // poolSettings: ...,
        // sslCredentials: ...,
        // clientOptions: ...,
        // logger: ...,
    });

    ydb.query.do<R>({ // R sample of DataType
        txControl: ...,
        syntax: ...,
        retryPolicy: ..., // ???
        statement: ???, // Is it
        op: ... // session handler
    })

    // TODO: Support dataType to conver




}

Main()
